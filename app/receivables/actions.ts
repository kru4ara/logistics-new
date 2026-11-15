'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '../../lib/require-office';
import { createClient } from '../../lib/supabase/admin';
import { logAudit } from '../../lib/audit';
import { getT } from '../../lib/i18n/server';
import { providerById } from '../../lib/invoicing';

/** Отметить счёт оплаченным сегодня. Дату оплаты ставит триггер trips_payment_dates. */
export async function markTripPaid(tripId: string): Promise<{ ok: boolean; message?: string }> {
  await requireCapability('receivables.edit');
  const { t } = await getT();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('trips')
    .update({ status: 'paid' })
    .eq('id', tripId)
    .eq('status', 'invoiced')
    .select('id, trip_number, invoice_provider, invoice_external_id')
    .maybeSingle();
  if (error) return { ok: false, message: t('dir.updateError', { msg: error.message }) };
  if (!data) return { ok: false, message: t('recv.notInvoiced') };

  // Оплату отмечаем и в сервисе фактур; сбой там не отменяет оплату в CRM.
  const provider = providerById(data.invoice_provider);
  if (provider && data.invoice_external_id) {
    await provider.markPaid(data.invoice_external_id as string).catch((e: unknown) =>
      console.error('[receivables] invoice paid', provider.id, e instanceof Error ? e.message : e),
    );
  }

  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'status_change',
    changes: { status: { before: 'invoiced', after: 'paid' } },
    summary: `Оплата заказа №${data.trip_number ?? '—'} (дебиторка)`,
  });
  revalidatePath('/receivables');
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}

const date = (v: FormDataEntryValue | null) => {
  const s = typeof v === 'string' ? v.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/** Поправить номер и даты счёта в карточке заказа. */
export async function updateTripPayment(tripId: string, formData: FormData): Promise<{ ok: boolean; message?: string }> {
  await requireCapability('receivables.edit');
  const { t } = await getT();
  const invoiceNumber = String(formData.get('invoice_number') ?? '').trim() || null;
  const patch = {
    invoice_number: invoiceNumber,
    invoiced_at: date(formData.get('invoiced_at')),
    payment_due: date(formData.get('payment_due')),
    paid_at: date(formData.get('paid_at')),
  };
  const supabase = await createClient();
  const { data: before } = await supabase
    .from('trips')
    .select('invoice_number, invoiced_at, payment_due, paid_at')
    .eq('id', tripId)
    .maybeSingle();
  const { error } = await supabase.from('trips').update(patch).eq('id', tripId);
  if (error) return { ok: false, message: t('dir.updateError', { msg: error.message }) };

  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const [k, v] of Object.entries(patch)) {
    const prev = (before as Record<string, unknown> | null)?.[k] ?? null;
    if (prev !== v) changes[k] = { before: prev, after: v };
  }
  if (Object.keys(changes).length) {
    await logAudit({ entity_type: 'trip', entity_id: tripId, action: 'update', changes, summary: 'Счёт и оплата заказа' });
  }
  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/receivables');
  return { ok: true };
}
