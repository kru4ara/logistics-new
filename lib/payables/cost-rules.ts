// Стоимость подрядчика на участке: план (цена из заявки) и факт (сумма счетов).
// Чистые правила — покрыты тестами.

export type InvoiceForCost = {
  net: number | null;
  /** корректирующая фактура (KOR, KOR_ZAL, …): её сумма — разница к основной */
  isCorrection?: boolean;
  gross: number | null;
  currency: string | null;
  /** сумма для себестоимости (costAmount) в EUR — по курсу на дату счёта; имя историческое */
  netEur: number | null;
};

/**
 * Сумма счета для себестоимости — брутто, полная стоимость (решение владельца: расходы
 * ведутся с НДС). Нет брутто — нетто (у иностранцев и odwrotne obciążenie они равны).
 */
export const costAmount = (i: Pick<InvoiceForCost, 'net' | 'gross'>): number | null => i.gross ?? i.net ?? null;

export type SegmentCost = {
  /** есть счета — считаем по ним */
  actual: boolean;
  amountEur: number;
  /** сумма в исходной валюте — если все счета в одной валюте, иначе в EUR */
  originalAmount: number;
  currency: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Тип фактуры KSeF/FA(3) — корректирующая? (KOR, KOR_ZAL, KOR_ROZ, Kor…) */
export const isCorrectionType = (t: string | null | undefined) => /^kor/i.test((t ?? '').trim());

/**
 * Стоимость участка.
 * • Есть основные счета — сумма их нетто плюс korekty (со своим знаком).
 * • Только korekty (основной счёт ещё не загружен/не привязан) — план плюс korekty:
 *   korekta — это разница, а не цена; нулевая korekta (исправление данных) ничего не меняет.
 * • Счета на 0 как основной факт не считаются.
 * Нет ни счетов, ни плана — null.
 */
export function segmentCost(
  plan: { price: number | null; currency: string | null; priceEur: number | null },
  invoices: InvoiceForCost[],
): SegmentCost | null {
  const usable = invoices.filter((i) => i.netEur != null && costAmount(i) != null && costAmount(i) !== 0);
  const base = usable.filter((i) => !i.isCorrection);
  const corrections = usable.filter((i) => i.isCorrection);
  const sumEur = (xs: InvoiceForCost[]) => xs.reduce((s, i) => s + (i.netEur as number), 0);
  const sumOrig = (xs: InvoiceForCost[]) => xs.reduce((s, i) => s + (costAmount(i) as number), 0);
  const curOf = (i: { currency: string | null }) => (i.currency || 'EUR').toUpperCase();

  if (base.length) {
    const all = [...base, ...corrections];
    const currencies = new Set(all.map(curOf));
    const amountEur = round2(sumEur(all));
    if (currencies.size === 1) return { actual: true, amountEur, originalAmount: round2(sumOrig(all)), currency: [...currencies][0] };
    return { actual: true, amountEur, originalAmount: amountEur, currency: 'EUR' };
  }

  if (plan.price == null || plan.priceEur == null) return null;
  const planCur = (plan.currency || 'EUR').toUpperCase();
  if (!corrections.length) return { actual: false, amountEur: round2(plan.priceEur), originalAmount: plan.price, currency: planCur };
  const amountEur = round2(plan.priceEur + sumEur(corrections));
  const sameCur = corrections.every((i) => curOf(i) === planCur);
  return {
    actual: true,
    amountEur,
    originalAmount: sameCur ? round2(plan.price + sumOrig(corrections)) : amountEur,
    currency: sameCur ? planCur : 'EUR',
  };
}

/** Расхождение факта с планом: больше 1 % и больше 1 € — подсветить. */
export function costDiff(planEur: number | null, actualEur: number | null) {
  if (planEur == null || actualEur == null) return null;
  const diff = round2(actualEur - planEur);
  const pct = planEur !== 0 ? Math.round((diff / planEur) * 1000) / 10 : null;
  return { diff, pct, notable: Math.abs(diff) > Math.max(1, Math.abs(planEur) * 0.01) };
}

export type ManualInvoiceInput = {
  invoiceNumber: string;
  issueDate: string;
  net: number;
  gross: number;
  currency: string;
  paymentDue: string | null;
};
export type ManualInvoiceError = 'number' | 'date' | 'amount' | 'currency' | 'due';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCIES = ['EUR', 'PLN', 'BYN', 'USD', 'CZK', 'HUF', 'RON', 'GBP', 'UAH', 'CHF', 'SEK', 'NOK', 'DKK'];

/**
 * Ручной счёт подрядчика из формы. Нетто обязательно (может быть отрицательным — korekta);
 * брутто пустое — равно нетто (иностранец, odwrotne obciążenie).
 */
export function parseManualInvoice(get: (k: string) => string | null): ManualInvoiceInput | ManualInvoiceError {
  const v = (k: string) => (get(k) ?? '').trim();
  const number = v('invoice_number');
  if (!number || number.length > 100) return 'number';
  const issueDate = v('issue_date');
  if (!ISO.test(issueDate)) return 'date';
  const toNum = (s: string) => (s === '' ? NaN : Number(s.replace(/\s/g, '').replace(',', '.')));
  const net = toNum(v('net_amount'));
  if (!Number.isFinite(net) || net === 0 || Math.abs(net) > 10_000_000) return 'amount';
  const grossRaw = v('gross_amount');
  const gross = grossRaw === '' ? net : toNum(grossRaw);
  if (!Number.isFinite(gross) || Math.sign(gross) !== Math.sign(net) || Math.abs(gross) < Math.abs(net)) return 'amount';
  const currency = v('currency').toUpperCase() || 'EUR';
  if (!CURRENCIES.includes(currency)) return 'currency';
  const due = v('payment_due');
  if (due && !ISO.test(due)) return 'due';
  return {
    invoiceNumber: number,
    issueDate,
    net: Math.round(net * 100) / 100,
    gross: Math.round(gross * 100) / 100,
    currency,
    paymentDue: due || null,
  };
}

export const MANUAL_CURRENCIES = CURRENCIES;
