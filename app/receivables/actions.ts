'use server';

import { revalidatePath } from 'next/cache';
import { settleTrips } from '../../lib/bank/apply';
import { requireCapability } from '../../lib/require-office';
import { createClient } from '../../lib/supabase/admin';
import { logAudit } from '../../lib/audit';
import { getT } from '../../lib/i18n/server';
import { providerById } from '../../lib/invoicing';
import { isKsefLocked } from '../../lib/invoicing/types';
import { runInvoiceSync, readUnmatched, dropUnmatched, readAppliedCorrections, writeAppliedCorrections } from '../../lib/invoicing/sync';
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
  let notice: string | undefined;
  if (provider && data.invoice_external_id) {
    await provider.markPaid(data.invoice_external_id as string).catch((e: unknown) => {
      if (isKsefLocked(e)) notice = t('recv.paidKsefManual');
      else console.error('[receivables] invoice paid', provider.id, e instanceof Error ? e.message : e);
    });
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
  return { ok: true, message: notice };
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
    .select('id, trip_number, status, invoice_provider, invoice_external_id, invoice_number, invoiced_at, payment_due, ksef_number, ksef_status, invoice_amount, invoice_currency')
    .eq('id', tripId)
    .maybeSingle();
  if (!trip) return { ok: false, message: t('inv.notFound') };
  // У заказа уже есть счёт — новый его заменяет (исходный обнулён корректой и выставлен
  // заново, например в другой валюте) или был привязан к заказу по ошибке. Старый не
  // скрываем: при следующей сверке он вернётся в «без заказа» — привязать к нужному
  // заказу или отметить «не к заказу», если обнулён.
  const replaced = trip.invoice_external_id && trip.invoice_external_id !== externalId ? (trip.invoice_external_id as string) : null;

  const { patch } = patchFromRemote(provider.id, r, trip as SyncTrip, true);
  if (replaced || trip.invoice_number) {
    patch.invoice_number = r.number ?? trip.invoice_number ?? null;
    patch.invoice_amount = r.gross;
    patch.invoice_currency = r.currency ?? null;
    if (r.issueDate) patch.invoiced_at = r.issueDate;
  }
  const { error } = await supabase.from('trips').update(patch).eq('id', tripId);
  if (error) {
    return { ok: false, message: /duplicate key/i.test(error.message) ? t('recv.unmatchedTaken') : t('dir.updateError', { msg: error.message }) };
  }
  await dropUnmatched(supabase, externalId, false);
  await settleTrips(supabase, [tripId]);
  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    changes: { invoice_number: { before: trip.invoice_number ?? null, after: r.number } },
    summary: trip.invoice_number && trip.invoice_number !== r.number
      ? `Фактура ${trip.invoice_number} заменена на ${r.number ?? externalId} (${provider.name}) в заказе №${trip.trip_number ?? '—'}`
      : `Фактура ${r.number ?? externalId} (${provider.name}) привязана к заказу №${trip.trip_number ?? '—'} вручную`,
  });
  revalidatePath('/receivables');
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}

/**
 * Добавить корректу (FK…) к счёту заказа: сумма счёта в заказе = счёт + разница из корректы
 * (например, +290 € за GPS-пломбу). Сверка с сервисом её дальше учитывает; банк узнаёт
 * номер корректы в назначении платежа.
 */
export async function linkCorrection(externalId: string, tripId: string): Promise<{ ok: boolean; message?: string }> {
  await requireCapability('receivables.edit');
  const { t } = await getT();
  const provider = getInvoiceProvider();
  if (!provider) return { ok: false, message: t('inv.notConfigured') };
  const supabase = await createClient();
  const state = await readUnmatched(supabase);
  const r = state?.items.find((x) => x.externalId === externalId);
  if (!r || state?.provider !== provider.id || r.kind !== 'correction') return { ok: false, message: t('recv.unmatchedGone') };
  const { data: trip } = await supabase
    .from('trips')
    .select('id, trip_number, invoice_number, invoice_amount, invoice_currency')
    .eq('id', tripId)
    .maybeSingle();
  if (!trip) return { ok: false, message: t('inv.notFound') };
  if (!trip.invoice_number || trip.invoice_amount == null) return { ok: false, message: t('recv2.corrNoInvoice') };
  const cur = (r.currency ?? '').toUpperCase();
  if (cur && trip.invoice_currency && cur !== String(trip.invoice_currency).toUpperCase()) {
    return { ok: false, message: t('recv2.corrCurrency', { a: cur, b: String(trip.invoice_currency) }) };
  }
  const gross = Number(r.gross ?? 0);
  const applied = await readAppliedCorrections(supabase);
  if (applied.some((c) => c.externalId === externalId)) return { ok: false, message: t('recv.unmatchedTaken') };
  const before = Number(trip.invoice_amount);
  const after = Math.round((before + gross) * 100) / 100;
  const { error } = await supabase.from('trips').update({ invoice_amount: after }).eq('id', tripId);
  if (error) return { ok: false, message: t('dir.updateError', { msg: error.message }) };
  await writeAppliedCorrections(supabase, [
    ...applied,
    { externalId, tripId, number: r.number, gross, currency: r.currency ?? null, issueDate: r.issueDate },
  ]);
  await dropUnmatched(supabase, externalId, false);
  await settleTrips(supabase, [tripId]);
  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    changes: { invoice_amount: { before, after } },
    summary: `Корректа ${r.number ?? externalId} (${gross >= 0 ? '+' : ''}${gross}) добавлена к счёту ${trip.invoice_number} заказа №${trip.trip_number ?? '—'}`,
  });
  revalidatePath('/receivables');
  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/bank');
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
