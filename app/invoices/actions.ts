'use server';

import { revalidatePath } from 'next/cache';
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

const ISSUABLE = ['completed', 'invoiced'];

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

  const { error: upErr } = await supabase
    .from('trips')
    .update({
      ...snapFields(res),
      invoice_provider: provider.id,
      invoice_external_id: res.externalId,
      invoiced_at: input.issueDate,
      payment_due: res.paymentDue,
      ...(trip.status === 'completed' ? { status: 'invoiced' } : {}),
    })
    .eq('id', tripId);
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
