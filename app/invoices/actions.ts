'use server';

import { revalidatePath } from 'next/cache';
import { settleTrips } from '../../lib/bank/apply';
import { requireCapability } from '../../lib/require-office';
import { createClient } from '../../lib/supabase/admin';
import { logAudit } from '../../lib/audit';
import { getT } from '../../lib/i18n/server';
import { getCompany } from '../../lib/company';
import { getInvoiceProvider, providerById } from '../../lib/invoicing';
import type { InvoiceSnapshot } from '../../lib/invoicing/types';
import {
  validateInvoice,
  normalizeCountry,
  normalizeTaxId,
  TAX_RATES,
  type InvoiceInput,
  type TaxRate,
  type NpKind,
  type InvoiceError,
} from '../../lib/invoice-rules';
import type { MessageKey } from '../../lib/i18n/translate';

type Result = { ok: boolean; message?: string };

const ERR: Record<InvoiceError, MessageKey> = {
  buyerName: 'inv.errBuyerName',
  buyerTaxId: 'inv.errBuyerTaxId',
  buyerNip: 'inv.errBuyerNip',
  buyerAddress: 'inv.errBuyerAddress',
  amount: 'inv.errAmount',
  dates: 'inv.errDates',
  positionName: 'inv.errPositionName',
  tax: 'inv.errTax',
};

// Фактуру можно выставить и по рейсу в пути (выгрузка уже была, рейс не закрыли).
const ISSUABLE = ['active', 'completed', 'invoiced'];

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v.trim() : '';
};

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Поля заказа из ответа сервиса фактур. Номер не затираем пустым. */
function snapFields(s: InvoiceSnapshot) {
  return {
    ...(s.number ? { invoice_number: s.number } : {}),
    ksef_status: s.ksef === 'none' ? null : s.ksef,
    ksef_number: s.ksefNumber,
    ksef_error: s.ksefError,
  };
}

/** Выставить фактуру по заказу в сервисе фактур компании. */
export async function issueInvoice(tripId: string, fd: FormData): Promise<Result> {
  await requireCapability('receivables.edit');
  const { t } = await getT();
  const provider = getInvoiceProvider();
  if (!provider) return { ok: false, message: t('inv.notConfigured') };

  const supabase = await createClient();
  const { data: trip, error } = await supabase
    .from('trips')
    .select('id, trip_number, status, invoice_external_id, clients(name, email, tax_id, street, post_code, city, country)')
    .eq('id', tripId)
    .maybeSingle();
  if (error) return { ok: false, message: t('dir.updateError', { msg: error.message }) };
  if (!trip) return { ok: false, message: t('inv.notFound') };
  if (trip.invoice_external_id) return { ok: false, message: t('inv.already') };
  if (!ISSUABLE.includes(trip.status)) return { ok: false, message: t('inv.badStatus') };

  const client = (Array.isArray(trip.clients) ? trip.clients[0] : trip.clients) as {
    name: string; email: string | null; tax_id: string | null; street: string | null;
    post_code: string | null; city: string | null; country: string | null;
  } | null;
  if (!client) return { ok: false, message: t('inv.noClient') };

  const country = normalizeCountry(client.country);
  const taxRaw = str(fd, 'tax');
  const tax = ((TAX_RATES as readonly string[]).includes(taxRaw) ? taxRaw : '') as TaxRate;
  const npKindRaw = str(fd, 'np_kind');
  const currency = str(fd, 'currency') === 'PLN' ? 'PLN' : 'EUR';
  const input: InvoiceInput = {
    tripId,
    issueDate: str(fd, 'issue_date'),
    sellDate: str(fd, 'sell_date'),
    paymentDays: Number(str(fd, 'payment_days') || '30'),
    currency,
    netAmount: Number(str(fd, 'net_amount').replace(',', '.')),
    tax,
    npKind: tax === 'np' && (npKindRaw === 'export_service' || npKindRaw === 'export_service_eu') ? (npKindRaw as NpKind) : null,
    reverseCharge: fd.get('reverse_charge') === 'on',
    positionName: str(fd, 'position_name'),
    lang: ['pl', 'en', 'pl/en'].includes(str(fd, 'lang')) ? str(fd, 'lang') : 'pl',
    note: str(fd, 'note') || null,
    buyer: {
      name: client.name,
      taxId: normalizeTaxId(client.tax_id, country),
      street: client.street,
      postCode: client.post_code,
      city: client.city,
      country,
      email: client.email,
    },
  };
  const invalid = validateInvoice(input);
  if (invalid) return { ok: false, message: t(ERR[invalid]) };

  const company = await getCompany();
  const bankAccount = (currency === 'EUR' ? company.accountEur : company.accountPln) || null;
  const sendToKsef = provider.autoKsef && fd.get('send_ksef') === 'on';

  let res;
  try {
    res = await provider.issue(input, { bankAccount, sendToKsef });
  } catch (e) {
    return { ok: false, message: t('inv.apiError', { provider: provider.name, msg: errMsg(e) }) };
  }

  const tripPatch = {
      ...snapFields(res),
      invoice_provider: provider.id,
      invoice_external_id: res.externalId,
      // Брутто фактуры — для дебиторки (сверка потом уточнит по сервису).
      invoice_amount: Math.round(input.netAmount * (/^\d+$/.test(input.tax) ? 1 + Number(input.tax) / 100 : 1) * 100) / 100,
      invoice_currency: input.currency,
      invoiced_at: input.issueDate,
      payment_due: res.paymentDue,
      ...(trip.status !== 'invoiced' ? { status: 'invoiced' } : {}),
  };
  let { error: upErr } = await supabase.from('trips').update(tripPatch).eq('id', tripId);
  // До миграции 030 колонок суммы нет — сохраняем без них, фактура уже выставлена.
  if (upErr && /invoice_amount|invoice_currency/.test(upErr.message)) {
    const { invoice_amount: _a, invoice_currency: _c, ...rest } = tripPatch;
    ({ error: upErr } = await supabase.from('trips').update(rest).eq('id', tripId));
  }
  if (upErr) {
    // Фактура в сервисе уже есть — не теряем её id в логах, повторно не выставлять.
    console.error('[invoices] trip update failed after invoice', provider.id, res.externalId, upErr.message);
    return { ok: false, message: t('inv.savedRemote', { provider: provider.name, number: res.number ?? res.externalId }) };
  }

  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    changes: { invoice_number: { before: null, after: res.number ?? null } },
    summary: `Фактура ${res.number ?? res.externalId} по заказу №${trip.trip_number ?? '—'} (${provider.name}${sendToKsef ? ', KSeF' : ''})`,
  });
  // Аванс из выписки мог уже закрыть этот счёт.
  await settleTrips(supabase, [tripId]);
  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/receivables');
  return { ok: true };
}

async function loadRef(tripId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('trips')
    .select('invoice_provider, invoice_external_id')
    .eq('id', tripId)
    .maybeSingle();
  const provider = providerById(data?.invoice_provider);
  const externalId = (data?.invoice_external_id as string | null) ?? null;
  return { supabase, provider, externalId };
}

/** Подтянуть номер фактуры и состояние KSeF из сервиса фактур. */
export async function refreshInvoice(tripId: string): Promise<Result> {
  await requireCapability('receivables.edit');
  const { t } = await getT();
  const { supabase, provider, externalId } = await loadRef(tripId);
  if (!provider || !externalId) return { ok: false, message: t('inv.notFound') };
  try {
    const s = await provider.refresh(externalId);
    await supabase.from('trips').update(snapFields(s)).eq('id', tripId);
  } catch (e) {
    return { ok: false, message: t('inv.apiError', { provider: provider.name, msg: errMsg(e) }) };
  }
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}

/** Повторить отправку в KSeF — у сервисов, которые отправляют сами. */
export async function resendInvoiceToKsef(tripId: string): Promise<Result> {
  await requireCapability('receivables.edit');
  const { t } = await getT();
  const { supabase, provider, externalId } = await loadRef(tripId);
  if (!provider || !externalId) return { ok: false, message: t('inv.notFound') };
  if (!provider.resendToKsef) return { ok: false, message: t('inv.manualKsef', { provider: provider.name }) };
  try {
    const s = await provider.resendToKsef(externalId);
    await supabase.from('trips').update(snapFields(s)).eq('id', tripId);
  } catch (e) {
    return { ok: false, message: t('inv.apiError', { provider: provider.name, msg: errMsg(e) }) };
  }
  await logAudit({ entity_type: 'trip', entity_id: tripId, action: 'update', changes: {}, summary: `Повторная отправка фактуры в KSeF (${provider.name})` });
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}

/** Фактура уже в KSeF (или отправляется) — удалить нельзя, только korekta. */
const IN_KSEF = (s: InvoiceSnapshot) => Boolean(s.ksefNumber) || s.ksef === 'ok' || s.ksef === 'processing';

/**
 * Отменить фактуру, пока она не ушла в KSeF: удалить в сервисе фактур и освободить заказ,
 * чтобы выставить заново. Отправленную в KSeF фактуру не удалить — нужна korekta.
 */
export async function cancelInvoice(tripId: string): Promise<Result> {
  await requireCapability('receivables.edit');
  const { t } = await getT();
  const supabase = await createClient();
  const { data: trip } = await supabase
    .from('trips')
    .select('trip_number, status, invoice_provider, invoice_external_id, invoice_number')
    .eq('id', tripId)
    .maybeSingle();
  const provider = providerById(trip?.invoice_provider);
  if (!trip?.invoice_external_id || !provider) return { ok: false, message: t('inv.notFound') };
  if (trip.status === 'paid') return { ok: false, message: t('inv.cancelPaid') };

  const externalId = trip.invoice_external_id as string;
  try {
    // Состояние спрашиваем у сервиса, а не у своей базы: фактуру могли отправить в KSeF только что.
    const s = await provider.refresh(externalId);
    if (IN_KSEF(s)) {
      await supabase.from('trips').update(snapFields(s)).eq('id', tripId);
      revalidatePath(`/trips/${tripId}`);
      return { ok: false, message: t('inv.cancelInKsef') };
    }
    await provider.cancel(externalId);
  } catch (e) {
    return { ok: false, message: t('inv.apiError', { provider: provider.name, msg: errMsg(e) }) };
  }

  const { error } = await supabase
    .from('trips')
    .update({
      invoice_provider: null,
      invoice_external_id: null,
      invoice_number: null,
      ksef_status: null,
      ksef_number: null,
      ksef_error: null,
      invoiced_at: null,
      payment_due: null,
      ...(trip.status === 'invoiced' ? { status: 'completed' } : {}),
    })
    .eq('id', tripId);
  if (error) return { ok: false, message: t('dir.updateError', { msg: error.message }) };

  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    changes: { invoice_number: { before: trip.invoice_number ?? null, after: null } },
    summary: `Отменена фактура ${trip.invoice_number ?? externalId} по заказу №${trip.trip_number ?? '—'} (${provider.name}, до KSeF)`,
  });
  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/receivables');
  return { ok: true };
}
