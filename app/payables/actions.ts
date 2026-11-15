'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '../../lib/require-office';
import { createClient } from '../../lib/supabase/admin';
import { logAudit } from '../../lib/audit';
import { getT } from '../../lib/i18n/server';
import { runKsefPurchaseSync } from '../../lib/payables/sync';

type Result = { ok: boolean; message?: string };

/** Загрузить входящие фактуры из KSeF сейчас (то же делает cron ночью). */
export async function syncPurchasesNow(): Promise<Result> {
  await requireCapability('payables.edit');
  const { t } = await getT();
  const r = await runKsefPurchaseSync();
  revalidatePath('/payables');
  if (!r.ok) {
    return { ok: false, message: r.reason === 'notConfigured' ? t('pay.notConfigured') : t('pay.syncError', { msg: r.message ?? '' }) };
  }
  return {
    ok: true,
    message:
      t('pay.syncDone', { downloaded: r.downloaded, matched: r.matched }) +
      (r.remaining > 0 ? ' ' + t('pay.syncRemaining', { n: r.remaining }) : ''),
  };
}

/** Привязать счёт к участку (segmentId) или отметить «не относится к рейсам» (null). */
export async function linkPurchase(invoiceId: string, segmentId: string | null): Promise<Result> {
  await requireCapability('payables.edit');
  const { t } = await getT();
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from('purchase_invoices')
    .select('id, invoice_number, ksef_number, segment_id')
    .eq('id', invoiceId)
    .maybeSingle();
  if (!inv) return { ok: false, message: t('pay.notFound') };

  let seg: { id: string; trip_id: string; position: number; contractor_id: string | null } | null = null;
  if (segmentId) {
    const { data } = await supabase
      .from('trip_segments')
      .select('id, trip_id, position, contractor_id')
      .eq('id', segmentId)
      .eq('executor_type', 'contractor')
      .maybeSingle();
    if (!data) return { ok: false, message: t('pay.segmentNotFound') };
    seg = data;
  }

  const { error } = await supabase
    .from('purchase_invoices')
    .update({
      segment_id: seg?.id ?? null,
      match_status: seg ? 'manual' : 'ignored',
      ...(seg?.contractor_id ? { contractor_id: seg.contractor_id } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId);
  if (error) return { ok: false, message: t('dir.updateError', { msg: error.message }) };

  if (seg) {
    await logAudit({
      entity_type: 'trip',
      entity_id: seg.trip_id,
      action: 'update',
      changes: { purchase_invoice: { before: null, after: inv.invoice_number } },
      summary: `Счёт подрядчика ${inv.invoice_number ?? inv.ksef_number} привязан к участку ${seg.position}`,
    });
    revalidatePath(`/trips/${seg.trip_id}`);
  }
  revalidatePath('/payables');
  return { ok: true };
}

/** Вернуть счёт в «требуют привязки». */
export async function unlinkPurchase(invoiceId: string): Promise<Result> {
  await requireCapability('payables.edit');
  const { t } = await getT();
  const supabase = await createClient();
  const { error } = await supabase
    .from('purchase_invoices')
    .update({ segment_id: null, match_status: 'none', updated_at: new Date().toISOString() })
    .eq('id', invoiceId);
  if (error) return { ok: false, message: t('dir.updateError', { msg: error.message }) };
  revalidatePath('/payables');
  return { ok: true };
}

/** Отметить оплату счёта подрядчика (или снять). */
export async function setPurchasePaid(invoiceId: string, paid: boolean): Promise<Result> {
  await requireCapability('payables.edit');
  const { t } = await getT();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('purchase_invoices')
    .update({ paid_at: paid ? new Date().toISOString().slice(0, 10) : null, updated_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .select('invoice_number, seller_name')
    .maybeSingle();
  if (error) return { ok: false, message: t('dir.updateError', { msg: error.message }) };
  if (!data) return { ok: false, message: t('pay.notFound') };
  await logAudit({
    entity_type: 'purchase_invoice',
    entity_id: invoiceId,
    action: 'update',
    changes: { paid: { before: !paid, after: paid } },
    summary: `Счёт подрядчика ${data.invoice_number ?? ''} (${data.seller_name ?? ''}) — ${paid ? 'оплачен' : 'оплата снята'}`,
  });
  revalidatePath('/payables');
  return { ok: true };
}
