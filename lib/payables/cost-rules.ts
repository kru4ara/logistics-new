// Стоимость подрядчика на участке: план (цена из заявки) и факт (сумма счетов).
// Чистые правила — покрыты тестами.

export type InvoiceForCost = {
  net: number | null;
  gross: number | null;
  currency: string | null;
  /** нетто в EUR (пересчитано по курсу на дату счёта) */
  netEur: number | null;
};

/**
 * Сумма счета для себестоимости — нетто: НДС фирма возвращает.
 * Нет нетто — брутто (у иностранцев и odwrotne obciążenie они равны).
 */
export const costAmount = (i: Pick<InvoiceForCost, 'net' | 'gross'>): number | null => i.net ?? i.gross ?? null;

export type SegmentCost = {
  /** есть счета — считаем по ним */
  actual: boolean;
  amountEur: number;
  /** сумма в исходной валюте — если все счета в одной валюте, иначе в EUR */
  originalAmount: number;
  currency: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Стоимость участка: счета есть — сумма их нетто (korekta — со своим знаком);
 * нет — план. Возвращает null, если и плана нет.
 */
export function segmentCost(
  plan: { price: number | null; currency: string | null; priceEur: number | null },
  invoices: InvoiceForCost[],
): SegmentCost | null {
  const usable = invoices.filter((i) => costAmount(i) != null && i.netEur != null);
  if (usable.length) {
    const currencies = new Set(usable.map((i) => (i.currency || 'EUR').toUpperCase()));
    const amountEur = round2(usable.reduce((s, i) => s + (i.netEur as number), 0));
    if (currencies.size === 1) {
      const currency = [...currencies][0];
      return { actual: true, amountEur, originalAmount: round2(usable.reduce((s, i) => s + (costAmount(i) as number), 0)), currency };
    }
    return { actual: true, amountEur, originalAmount: amountEur, currency: 'EUR' };
  }
  if (plan.price == null || plan.priceEur == null) return null;
  return { actual: false, amountEur: round2(plan.priceEur), originalAmount: plan.price, currency: (plan.currency || 'EUR').toUpperCase() };
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
