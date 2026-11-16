'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '../../lib/require-office';
import { createClient } from '../../lib/supabase/admin';
import { logAudit } from '../../lib/audit';
import { getT } from '../../lib/i18n/server';
import { runKsefPurchaseSync } from '../../lib/payables/sync';
import { recalcSegmentCost } from '../../lib/payables/cost';
import { parseManualInvoice } from '../../lib/payables/cost-rules';
import { invoiceKey, isValidPaidDate } from '../../lib/payables/duplicate-rules';
import { syncInvoiceTripExpense } from '../../lib/payables/trip-expense';
import { isMonthClosed, tripMonth } from '../../lib/closed-months';
import { EXPENSE_CATEGORIES } from '../../lib/i18n/labels';

type Result = { ok: boolean; message?: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Рейс, к которому счёт привязан как расход (до миграции 037 колонки нет — null). */
async function invoiceTripId(supabase: Supabase, invoiceId: string): Promise<string | null> {
  const { data, error } = await supabase.from('purchase_invoices').select('trip_id').eq('id', invoiceId).maybeSingle();
  return error ? null : ((data?.trip_id as string | null) ?? null);
}

/** Снять привязку счёта к рейсу-расходу (перед привязкой к участку, «не относится», отвязкой). */
async function detachFromTrip(supabase: Supabase, invoiceId: string, tripId: string | null): Promise<void> {
  if (!tripId) return;
  await supabase.from('purchase_invoices').update({ trip_id: null }).eq('id', invoiceId);
  await syncInvoiceTripExpense(supabase, invoiceId);
  revalidatePath(`/trips/${tripId}`);
}

/** Загрузить входящие фактуры из KSeF сейчас (то же делает cron ночью). */
export async function syncPurchasesNow(since?: string): Promise<Result> {
  await requireCapability('payables.edit');
  const { t } = await getT();
  if (since !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(since)) return { ok: false, message: t('pay.errDate') };
  const r = await runKsefPurchaseSync(since ? { since } : {});
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
  const previousSegment = inv.segment_id as string | null;

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
  await detachFromTrip(supabase, invoiceId, await invoiceTripId(supabase, invoiceId));

  // Факт стоимости — по счетам: пересчитать и прежний участок, и новый.
  if (previousSegment && previousSegment !== seg?.id) await recalcSegmentCost(supabase, previousSegment);
  if (seg) await recalcSegmentCost(supabase, seg.id);

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
  const { data: before } = await supabase.from('purchase_invoices').select('segment_id, trip_segments(trip_id)').eq('id', invoiceId).maybeSingle();
  const { error } = await supabase
    .from('purchase_invoices')
    .update({ segment_id: null, match_status: 'none', updated_at: new Date().toISOString() })
    .eq('id', invoiceId);
  if (error) return { ok: false, message: t('dir.updateError', { msg: error.message }) };
  await detachFromTrip(supabase, invoiceId, await invoiceTripId(supabase, invoiceId));
  if (before?.segment_id) {
    await recalcSegmentCost(supabase, before.segment_id as string);
    const tripId = (Array.isArray(before.trip_segments) ? before.trip_segments[0] : before.trip_segments as any)?.trip_id;
    if (tripId) revalidatePath(`/trips/${tripId}`);
  }
  revalidatePath('/payables');
  return { ok: true };
}

const TRIP_CATEGORIES = new Set<string>(EXPENSE_CATEGORIES.map((c) => c.value));

/**
 * Привязать счёт к рейсу целиком как расход (перегруз, EX-1, EPI, склад), а не к участку
 * перевозчика. Расход появляется в рейсе обычной строкой с выбранной категорией.
 */
export async function linkPurchaseToTrip(invoiceId: string, tripId: string, category: string): Promise<Result> {
  await requireCapability('payables.edit');
  const { t } = await getT();
  if (!TRIP_CATEGORIES.has(category)) return { ok: false, message: t('payx2.errCategory') };
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from('purchase_invoices')
    .select('id, invoice_number, ksef_number, seller_name, segment_id')
    .eq('id', invoiceId)
    .maybeSingle();
  if (!inv) return { ok: false, message: t('pay.notFound') };
  const { data: trip } = await supabase.from('trips').select('id, trip_number, start_date, end_date').eq('id', tripId).maybeSingle();
  if (!trip) return { ok: false, message: t('payx2.errTrip') };
  const previousTrip = await invoiceTripId(supabase, invoiceId);
  for (const id of [tripId, previousTrip]) {
    if (!id) continue;
    const { data: tr } = id === tripId ? { data: trip } : await supabase.from('trips').select('start_date, end_date').eq('id', id).maybeSingle();
    if (await isMonthClosed(supabase, tripMonth(tr as { start_date: string | null; end_date: string | null } | null))) {
      return { ok: false, message: t('payx2.errClosed') };
    }
  }

  const { error } = await supabase
    .from('purchase_invoices')
    .update({ trip_id: tripId, segment_id: null, match_status: 'manual', updated_at: new Date().toISOString() })
    .eq('id', invoiceId);
  if (error) {
    return { ok: false, message: /trip_id/.test(error.message) ? t('pay.needMigration') : t('dir.updateError', { msg: error.message }) };
  }
  if (inv.segment_id) await recalcSegmentCost(supabase, inv.segment_id as string);
  await syncInvoiceTripExpense(supabase, invoiceId, category);

  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    changes: { purchase_invoice: { before: null, after: inv.invoice_number }, category: { before: null, after: category } },
    summary: `Счёт ${inv.invoice_number ?? inv.ksef_number ?? ''} (${inv.seller_name ?? ''}) привязан к рейсу ${trip.trip_number ?? ''} как расход`,
  });
  if (previousTrip && previousTrip !== tripId) revalidatePath(`/trips/${previousTrip}`);
  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/payables');
  return { ok: true };
}

/**
 * Отметить оплату счёта подрядчика (или снять). date — день оплаты по выписке
 * (YYYY-MM-DD, не в будущем); без даты — сегодня. Повторный вызов с датой — исправить дату.
 */
export async function setPurchasePaid(invoiceId: string, paid: boolean, date?: string): Promise<Result> {
  await requireCapability('payables.edit');
  const { t } = await getT();
  const today = new Date().toISOString().slice(0, 10);
  const paidAt = paid ? date || today : null;
  if (paidAt && !isValidPaidDate(paidAt, today)) return { ok: false, message: t('payx.errPaidDate') };
  const supabase = await createClient();
  const { data: before } = await supabase.from('purchase_invoices').select('paid_at').eq('id', invoiceId).maybeSingle();
  if (!before) return { ok: false, message: t('pay.notFound') };
  const { data, error } = await supabase
    .from('purchase_invoices')
    .update({ paid_at: paidAt, updated_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .select('invoice_number, seller_name')
    .maybeSingle();
  if (error) return { ok: false, message: t('dir.updateError', { msg: error.message }) };
  if (!data) return { ok: false, message: t('pay.notFound') };
  await logAudit({
    entity_type: 'purchase_invoice',
    entity_id: invoiceId,
    action: 'update',
    changes: { paid_at: { before: before.paid_at ?? null, after: paidAt } },
    summary: `Счёт подрядчика ${data.invoice_number ?? ''} (${data.seller_name ?? ''}) — ${paidAt ? `оплачен ${paidAt}` : 'оплата снята'}`,
  });
  revalidatePath('/payables');
  return { ok: true };
}

const MANUAL_ERR = {
  number: 'pay.errNumber',
  date: 'pay.errDate',
  amount: 'pay.errAmount',
  currency: 'pay.errCurrency',
  due: 'pay.errDue',
} as const;

// Vercel принимает запрос до 4,5 МБ — файл до 4 МБ.
const MAX_FILE = 4 * 1024 * 1024;
const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/** Внести счёт подрядчика вручную (иностранный перевозчик, PDF по email) — к участку рейса. */
export async function addManualPurchase(fd: FormData): Promise<Result> {
  await requireCapability('payables.edit');
  const { t } = await getT();
  const segmentId = String(fd.get('segment_id') ?? '');
  const parsed = parseManualInvoice((k) => (typeof fd.get(k) === 'string' ? (fd.get(k) as string) : null));
  if (typeof parsed === 'string') return { ok: false, message: t(MANUAL_ERR[parsed]) };

  const supabase = await createClient();
  const { data: seg } = await supabase
    .from('trip_segments')
    .select('id, trip_id, position, contractor_id, contractor_payment_days, contractors(name, tax_id)')
    .eq('id', segmentId)
    .eq('executor_type', 'contractor')
    .maybeSingle();
  if (!seg) return { ok: false, message: t('pay.segmentNotFound') };
  const contractor = (Array.isArray(seg.contractors) ? seg.contractors[0] : seg.contractors) as { name: string; tax_id: string | null } | null;

  const file = fd.get('file');
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile && (file.size > MAX_FILE || !FILE_TYPES.includes(file.type))) return { ok: false, message: t('pay.errFile') };

  // Тот же счёт уже пришёл из KSeF — второй раз не вносим (иначе расход рейса удвоится).
  const key = invoiceKey(contractor?.tax_id, parsed.invoiceNumber);
  if (key) {
    const { data: same } = await supabase
      .from('purchase_invoices')
      .select('seller_nip, invoice_number')
      .eq('source', 'ksef')
      .ilike('invoice_number', parsed.invoiceNumber.trim());
    if ((same ?? []).some((x) => invoiceKey(x.seller_nip, x.invoice_number) === key)) {
      return { ok: false, message: t('payx.errKsefExists') };
    }
  }

  const days = Number(seg.contractor_payment_days ?? 30);
  const due = parsed.paymentDue ?? new Date(Date.parse(parsed.issueDate) + (Number.isFinite(days) ? days : 30) * 86_400_000).toISOString().slice(0, 10);

  const { data: created, error } = await supabase
    .from('purchase_invoices')
    .insert({
      source: 'manual',
      ksef_number: null,
      invoice_number: parsed.invoiceNumber,
      issue_date: parsed.issueDate,
      seller_name: contractor?.name ?? null,
      seller_nip: contractor?.tax_id ?? null,
      net_amount: parsed.net,
      vat_amount: Math.round((parsed.gross - parsed.net) * 100) / 100,
      gross_amount: parsed.gross,
      currency: parsed.currency,
      payment_due: due,
      contractor_id: seg.contractor_id,
      segment_id: seg.id,
      match_status: 'manual',
    })
    .select('id')
    .single();
  if (error) {
    return { ok: false, message: /duplicate key/i.test(error.message) ? t('pay.errDuplicate') : t('dir.addError', { msg: error.message }) };
  }

  if (hasFile) {
    const safe = file.name.replace(/[^\w.-]+/g, '_').slice(-80);
    const path = `purchase_invoices/${created.id}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage
      .from('documents')
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (upErr) {
      await supabase.from('purchase_invoices').delete().eq('id', created.id);
      return { ok: false, message: t('pay.errUpload', { msg: upErr.message }) };
    }
    await supabase.from('purchase_invoices').update({ file_path: path }).eq('id', created.id);
  }

  await recalcSegmentCost(supabase, seg.id);
  await logAudit({
    entity_type: 'trip',
    entity_id: seg.trip_id,
    action: 'update',
    changes: { purchase_invoice: { before: null, after: parsed.invoiceNumber } },
    summary: `Внесён счёт подрядчика ${parsed.invoiceNumber} (${contractor?.name ?? ''}) к участку ${seg.position}: ${parsed.net} ${parsed.currency} нетто`,
  });
  revalidatePath(`/trips/${seg.trip_id}`);
  revalidatePath('/payables');
  return { ok: true };
}

/** Удалить внесённый вручную счёт (из KSeF — нельзя: только отвязать). */
export async function deleteManualPurchase(invoiceId: string): Promise<Result> {
  await requireCapability('payables.edit');
  const { t } = await getT();
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from('purchase_invoices')
    .select('id, source, file_path, segment_id, invoice_number, trip_segments(trip_id)')
    .eq('id', invoiceId)
    .maybeSingle();
  if (!inv) return { ok: false, message: t('pay.notFound') };
  if (inv.source !== 'manual') return { ok: false, message: t('pay.errKsefDelete') };

  const { error } = await supabase.from('purchase_invoices').delete().eq('id', invoiceId);
  if (error) return { ok: false, message: t('dir.updateError', { msg: error.message }) };
  if (inv.file_path) await supabase.storage.from('documents').remove([inv.file_path as string]);
  const tripId = (Array.isArray(inv.trip_segments) ? inv.trip_segments[0] : (inv.trip_segments as any))?.trip_id as string | undefined;
  if (inv.segment_id) await recalcSegmentCost(supabase, inv.segment_id as string);
  if (tripId) {
    await logAudit({
      entity_type: 'trip',
      entity_id: tripId,
      action: 'update',
      changes: { purchase_invoice: { before: inv.invoice_number, after: null } },
      summary: `Удалён счёт подрядчика ${inv.invoice_number ?? ''} (внесён вручную)`,
    });
    revalidatePath(`/trips/${tripId}`);
  }
  revalidatePath('/payables');
  return { ok: true };
}
