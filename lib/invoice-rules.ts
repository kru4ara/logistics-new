// Чистые правила фактуры (без сети и Supabase — покрыты тестами): общие для всех
// сервисов фактур (НДС, проверки, реквизиты) и JSON для Fakturownia.
import type { KsefState } from './invoicing/types';

export const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
] as const;

/** Ставки позиции, которые принимает Fakturownia (и KSeF). */
export const TAX_RATES = ['23', '8', '5', '0', 'np', 'zw'] as const;
export type TaxRate = (typeof TAX_RATES)[number];

/** Вид «не подлежит»: услуга вне ЕС (P_13_8) или в ЕС по art. 100 ust. 1 pkt 4 (P_13_9). */
export type NpKind = 'export_service' | 'export_service_eu';

export type VatTreatment = { tax: TaxRate; npKind: NpKind | null; reverseCharge: boolean };

/** Код страны: 'pl', ' Pl ' → 'PL'; не две латинские буквы → null. */
export function normalizeCountry(v: string | null | undefined): string | null {
  const s = (v ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : null;
}

/** Номер плательщика: без пробелов и дефисов; польский NIP — без префикса PL. */
export function normalizeTaxId(v: string | null | undefined, country: string | null): string | null {
  const s = (v ?? '').replace(/[\s-]/g, '').toUpperCase();
  if (!s) return null;
  if (country === 'PL' && /^PL\d{10}$/.test(s)) return s.slice(2);
  // VAT UE пишется с префиксом страны (у Греции — EL); без префикса — добавляем.
  if (country && country !== 'PL' && (EU_COUNTRIES as readonly string[]).includes(country) && /^\d/.test(s)) {
    return (country === 'GR' ? 'EL' : country) + s;
  }
  return s;
}

/** Контрольная сумма польского NIP. */
export function isValidNip(nip: string): boolean {
  if (!/^\d{10}$/.test(nip)) return false;
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = w.reduce((acc, k, i) => acc + k * Number(nip[i]), 0);
  return sum % 11 === Number(nip[9]);
}

/**
 * Предложение НДС по стране покупателя — только значение по умолчанию в форме,
 * офис может поменять. Транспортная услуга B2B облагается по месту покупателя
 * (art. 28b): польский покупатель — 23 %, покупатель из ЕС — «np» с пометкой
 * «odwrotne obciążenie», вне ЕС — «np» (услуга за пределами ЕС).
 */
export function suggestVat(country: string | null): VatTreatment {
  if (!country || country === 'PL') return { tax: '23', npKind: null, reverseCharge: false };
  if ((EU_COUNTRIES as readonly string[]).includes(country)) {
    return { tax: 'np', npKind: 'export_service_eu', reverseCharge: true };
  }
  return { tax: 'np', npKind: 'export_service', reverseCharge: false };
}

/** Язык фактуры: польскому покупателю — польский, остальным — польско-английская. */
export const suggestLang = (country: string | null) => (!country || country === 'PL' ? 'pl' : 'pl/en');

export type InvoiceInput = {
  tripId: string;
  issueDate: string;
  sellDate: string;
  paymentDays: number;
  currency: string;
  netAmount: number;
  tax: TaxRate;
  npKind: NpKind | null;
  reverseCharge: boolean;
  positionName: string;
  lang: string;
  note: string | null;
  buyer: {
    name: string;
    taxId: string | null;
    street: string | null;
    postCode: string | null;
    city: string | null;
    country: string | null;
    email: string | null;
  };
};

export type InvoiceError =
  | 'buyerName'
  | 'buyerTaxId'
  | 'buyerNip'
  | 'buyerAddress'
  | 'amount'
  | 'dates'
  | 'positionName'
  | 'tax';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Проверка перед отправкой: код ошибки (текст подбирает страница) или null. */
export function validateInvoice(i: InvoiceInput): InvoiceError | null {
  if (!i.buyer.name.trim()) return 'buyerName';
  // KSeF: у покупателя-фирмы номер обязателен.
  if (!i.buyer.taxId) return 'buyerTaxId';
  if ((i.buyer.country ?? 'PL') === 'PL' && !isValidNip(i.buyer.taxId)) return 'buyerNip';
  if (!i.buyer.street || !i.buyer.city || !i.buyer.country) return 'buyerAddress';
  if (!(i.netAmount > 0) || !Number.isFinite(i.netAmount)) return 'amount';
  if (!ISO_DATE.test(i.issueDate) || !ISO_DATE.test(i.sellDate)) return 'dates';
  if (!Number.isInteger(i.paymentDays) || i.paymentDays < 0 || i.paymentDays > 365) return 'dates';
  const name = i.positionName.trim();
  if (!name || name.length > 256) return 'positionName';
  if (!(TAX_RATES as readonly string[]).includes(i.tax)) return 'tax';
  return null;
}

const DAY = 86_400_000;
export function addDaysIso(d: string, n: number): string {
  const t = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) + n * DAY;
  return new Date(t).toISOString().slice(0, 10);
}

/** Вид номера покупателя для Fakturownia: польский NIP — пусто, ЕС — nip_ue, иначе other. */
export function taxNoKind(country: string | null, taxId: string): '' | 'nip_ue' | 'other' {
  if (!country || country === 'PL') return '';
  if ((EU_COUNTRIES as readonly string[]).includes(country) && /^[A-Z]{2}/.test(taxId)) return 'nip_ue';
  return 'other';
}

/** JSON фактуры для POST /invoices.json. Продавец — из настроек аккаунта Fakturownia. */
export function buildInvoicePayload(i: InvoiceInput, bankAccount: string | null) {
  const tax = i.tax === 'np' || i.tax === 'zw' ? i.tax : Number(i.tax);
  const net = Math.round(i.netAmount * 100) / 100;
  const position: Record<string, unknown> = {
    name: i.positionName.trim(),
    quantity: 1,
    quantity_unit: 'usł.',
    tax,
    price_net: net,
  };
  const invoice: Record<string, unknown> = {
    kind: 'vat',
    number: null,
    issue_date: i.issueDate,
    sell_date: i.sellDate,
    payment_to: addDaysIso(i.issueDate, i.paymentDays),
    payment_type: 'transfer',
    currency: i.currency,
    lang: i.lang,
    oid: i.tripId,
    oid_unique: 'yes',
    buyer_company: true,
    buyer_name: i.buyer.name.trim(),
    buyer_tax_no: i.buyer.taxId,
    buyer_tax_no_kind: taxNoKind(i.buyer.country, i.buyer.taxId ?? ''),
    buyer_street: i.buyer.street,
    buyer_post_code: i.buyer.postCode,
    buyer_city: i.buyer.city,
    buyer_country: i.buyer.country,
    reverse_charge: i.reverseCharge,
    positions: [position],
  };
  // Фактура в валюте: НДС в злотых по курсу NBP — считает сама Fakturownia.
  if (i.currency !== 'PLN') {
    invoice.exchange_currency = 'PLN';
    invoice.exchange_kind = 'nbp';
  }
  if (i.tax === 'np' && i.npKind) invoice.np_tax_kind = i.npKind;
  if (i.buyer.email) invoice.buyer_email = i.buyer.email;
  if (bankAccount) invoice.seller_bank_account = bankAccount;
  const note = [i.reverseCharge ? 'Odwrotne obciążenie' : null, i.note?.trim() || null].filter(Boolean).join('. ');
  if (note) invoice.description = note.slice(0, 256);
  return { invoice };
}

/** gov_status Fakturownia → наше состояние KSeF. */
export function fakturowniaKsefState(govStatus: string | null | undefined): KsefState {
  switch (govStatus) {
    case null:
    case undefined:
    case '':
      return 'none';
    case 'ok':
    case 'demo_ok':
      return 'ok';
    case 'processing':
    case 'demo_processing':
    case 'offline':
      return 'processing';
    case 'not_connected':
      return 'notConnected';
    case 'not_applicable':
      return 'notApplicable';
    default:
      return 'error';
  }
}

/** Ошибки KSeF из ответа Fakturownia — одной строкой (они бывают массивом или строкой). */
export function govErrors(v: unknown): string | null {
  if (!v) return null;
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean).join('; ') || null;
  return String(v);
}

/** Текст позиции: «Usługa transportowa: Poznań, PL → Berlin, DE. Zlecenie nr 123». */
export function positionName(route: string | null, requestNo: string | null, tripNumber: string | null): string {
  const parts = ['Usługa transportowa' + (route ? `: ${route}` : '')];
  if (requestNo) parts.push(`Zlecenie nr ${requestNo}`);
  else if (tripNumber) parts.push(`Zlecenie nr ${tripNumber}`);
  return parts.join('. ').slice(0, 256);
}

export type ClientRequisites = {
  tax_id: string | null;
  street: string | null;
  post_code: string | null;
  city: string | null;
  country: string | null;
};

/** Реквизиты клиента из формы. Пустая страна — можно; не код из двух букв — ошибка. */
export function parseClientRequisites(get: (k: string) => string | null): ClientRequisites | 'badCountry' {
  const v = (k: string) => (get(k) ?? '').trim() || null;
  const countryRaw = v('country');
  const country = countryRaw ? normalizeCountry(countryRaw) : null;
  if (countryRaw && !country) return 'badCountry';
  return {
    tax_id: normalizeTaxId(v('tax_id'), country),
    street: v('street'),
    post_code: v('post_code'),
    city: v('city'),
    country,
  };
}
