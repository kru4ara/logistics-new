'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '../../lib/require-office';
import { createClient } from '../../lib/supabase/admin';
import { logAudit } from '../../lib/audit';
import { getT } from '../../lib/i18n/server';
import { getCompany } from '../../lib/company';
import {
  createInvoice,
  getInvoice,
  resendToKsef,
  isFakturowniaConfigured,
  FakturowniaError,
  type FakturowniaInvoice,
} from '../../lib/fakturownia';
import {
  validateInvoice,
  buildInvoicePayload,
  normalizeCountry,
  normalizeTaxId,
  govErrors,
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

/** Поля заказа из ответа Fakturownia: номер, срок, состояние KSeF. */
function ksefFields(inv: FakturowniaInvoice) {
  return {
    invoice_number: inv.number ?? null,
    ksef_status: inv.gov_status ?? null,
    ksef_number: inv.gov_id ?? null,
    ksef_error: govErrors(inv.gov_error_messages),
  };
}

/** Выставить фактуру по заказу в Fakturownia (и сразу отправить в KSeF). */
export async function issueInvoice(tripId: string, fd: FormData): Promise<Result> {
  await requireCapability('receivables.edit');
  const { t } = await getT();
  if (!isFakturowniaConfigured()) return { ok: false, message: t('inv.notConfigured') };

  const supabase = await createClient();
  const { data: trip, error } = await supabase
    .from('trips')
    .select('id, trip_number, status, fakturownia_id, clients(name, email, tax_id, street, post_code, city, country)')
    .eq('id', tripId)
    .maybeSingle();
  if (error) return { ok: false, message: t('dir.updateError', { msg: error.message }) };
  if (!trip) return { ok: false, message: t('inv.notFound') };
  if (trip.fakturownia_id) return { ok: false, message: t('inv.already') };
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
  const bank = (currency === 'EUR' ? company.accountEur : company.accountPln) || null;
  const sendToKsef = fd.get('send_ksef') === 'on';

  let inv: FakturowniaInvoice;
  try {
    inv = await createInvoice(buildInvoicePayload(input, bank), sendToKsef);
  } catch (e) {
    const msg = e instanceof FakturowniaError ? e.message : String(e);
    return { ok: false, message: t('inv.apiError', { msg }) };
  }

  const { error: upErr } = await supabase
    .from('trips')
    .update({
      ...ksefFields(inv),
      fakturownia_id: inv.id,
      invoiced_at: input.issueDate,
      payment_due: inv.payment_to ?? null,
      ...(trip.status === 'completed' ? { status: 'invoiced' } : {}),
    })
    .eq('id', tripId);
  if (upErr) {
    // Фактура в Fakturownia уже есть — не теряем её id: повтор вернёт ошибку oid_unique.
    console.error('[invoices] trip update failed after invoice', inv.id, upErr.message);
    return { ok: false, message: t('inv.savedRemote', { number: inv.number ?? String(inv.id) }) };
  }

  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    changes: { invoice_number: { before: null, after: inv.number ?? null } },
    summary: `Фактура ${inv.number ?? inv.id} по заказу №${trip.trip_number ?? '—'} (Fakturownia${sendToKsef ? ', KSeF' : ''})`,
  });
  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/receivables');
  return { ok: true };
}

async function loadInvoiceId(tripId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from('trips').select('fakturownia_id').eq('id', tripId).maybeSingle();
  return { supabase, id: (data?.fakturownia_id as number | null) ?? null };
}

/** Подтянуть номер и состояние KSeF из Fakturownia. */
export async function refreshInvoice(tripId: string): Promise<Result> {
  await requireCapability('receivables.edit');
  const { t } = await getT();
  const { supabase, id } = await loadInvoiceId(tripId);
  if (!id) return { ok: false, message: t('inv.notFound') };
  try {
    const inv = await getInvoice(id);
    await supabase.from('trips').update(ksefFields(inv)).eq('id', tripId);
  } catch (e) {
    return { ok: false, message: t('inv.apiError', { msg: e instanceof Error ? e.message : String(e) }) };
  }
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}

/** Повторить отправку в KSeF (например, после исправления реквизитов в Fakturownia). */
export async function resendInvoiceToKsef(tripId: string): Promise<Result> {
  await requireCapability('receivables.edit');
  const { t } = await getT();
  const { supabase, id } = await loadInvoiceId(tripId);
  if (!id) return { ok: false, message: t('inv.notFound') };
  try {
    const inv = await resendToKsef(id);
    await supabase.from('trips').update(ksefFields(inv)).eq('id', tripId);
  } catch (e) {
    return { ok: false, message: t('inv.apiError', { msg: e instanceof Error ? e.message : String(e) }) };
  }
  await logAudit({ entity_type: 'trip', entity_id: tripId, action: 'update', changes: {}, summary: 'Повторная отправка фактуры в KSeF' });
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}
