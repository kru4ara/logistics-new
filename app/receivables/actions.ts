'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '../../lib/require-office';
import { createClient } from '../../lib/supabase/admin';
import { logAudit } from '../../lib/audit';
import { getT } from '../../lib/i18n/server';
import { providerById } from '../../lib/invoicing';
import { runInvoiceSync, readUnmatched, dropUnmatched } from '../../lib/invoicing/sync';
import { patchFromRemote, type SyncTrip } from '../../lib/invoicing/sync-rules';
import { getInvoiceProvider } from '../../lib/invoicing';

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

/** Сверить дебиторку с сервисом фактур сейчас (то же делает cron раз в день). */
export async function syncInvoicesNow(): Promise<{ ok: boolean; message: string }> {
  await requireCapability('receivables.edit');
  const { t } = await getT();
  const r = await runInvoiceSync();
  if (!r.ok) {
    if (r.reason === 'notConfigured') return { ok: false, message: t('inv.notConfigured') };
    if (r.reason === 'unsupported') return { ok: false, message: t('recv.syncUnsupported') };
    return { ok: false, message: t('recv.syncError', { msg: r.message ?? '' }) };
  }
  revalidatePath('/receivables');
  return {
    ok: true,
    message: t('recv.syncDone', {
      provider: r.provider, checked: r.checked, updated: r.updated, paid: r.paid, ksef: r.ksef, linked: r.linked,
    }) + (r.unpaidUnmatched ? ' ' + t('recv.syncUnmatched', { n: r.unpaidUnmatched }) : ''),
  };
}

/** Привязать фактуру сервиса (из списка «без заказа») к заказу: номер, даты, KSeF, оплата. */
export async function linkRemoteInvoice(externalId: string, tripId: string): Promise<{ ok: boolean; message?: string }> {
  await requireCapability('receivables.edit');
  const { t } = await getT();
  const provider = getInvoiceProvider();
  if (!provider) return { ok: false, message: t('inv.notConfigured') };
  const supabase = await createClient();
  const state = await readUnmatched(supabase);
  const r = state?.items.find((x) => x.externalId === externalId);
  if (!r || state?.provider !== provider.id) return { ok: false, message: t('recv.unmatchedGone') };

  const { data: trip } = await supabase
    .from('trips')
    .select('id, trip_number, status, invoice_provider, invoice_external_id, invoice_number, invoiced_at, payment_due, ksef_number, ksef_status')
    .eq('id', tripId)
    .maybeSingle();
  if (!trip) return { ok: false, message: t('inv.notFound') };
  if (trip.invoice_external_id) return { ok: false, message: t('inv.already') };

  const { patch } = patchFromRemote(provider.id, r, trip as SyncTrip, true);
  const { error } = await supabase.from('trips').update(patch).eq('id', tripId);
  if (error) {
    return { ok: false, message: /duplicate key/i.test(error.message) ? t('recv.unmatchedTaken') : t('dir.updateError', { msg: error.message }) };
  }
  await dropUnmatched(supabase, externalId, false);
  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    changes: { invoice_number: { before: trip.invoice_number ?? null, after: r.number } },
    summary: `Фактура ${r.number ?? externalId} (${provider.name}) привязана к заказу №${trip.trip_number ?? '—'} вручную`,
  });
  revalidatePath('/receivables');
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}

/** Фактура не относится к заказам (услуга вне перевозок и т. п.) — убрать из списка. */
export async function ignoreRemoteInvoice(externalId: string): Promise<{ ok: boolean; message?: string }> {
  await requireCapability('receivables.edit');
  const supabase = await createClient();
  await dropUnmatched(supabase, externalId, true);
  revalidatePath('/receivables');
  return { ok: true };
}
