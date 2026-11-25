// Статистика по подрядчикам — чистые правила (тесты).
//
// Каждый участок подрядчика считается ровно один раз: заказ в режиме
// экспедирования → «экспедирование», иначе → «рейс».
// План — цена участка, переведённая в EUR по курсу на дату заказа.
// Факт — расход рейса категории «Подрядчик» по участку (EUR): после счёта
// подрядчика это сумма счёта, с доплатами и корректами — то же, что идёт в прибыль.
// Отменённые заказы не считаются.

import { eurAt, type RateRow } from './plan-fact';

export type ContractorSegmentRow = {
  id: string;
  trip_id: string;
  contractor_id: string | null;
  price: number | string | null;
  currency: string | null;
  contractor_payment_days: number | null;
  trips:
    | { status: string | null; profit_mode: string | null; start_date: string | null; end_date: string | null }
    | { status: string | null; profit_mode: string | null; start_date: string | null; end_date: string | null }[]
    | null;
};

export type ContractorTotals = {
  tripCount: number;
  tripFact: number;
  fwdCount: number;
  fwdFact: number;
  /** всего работ (участков) */
  count: number;
  planEur: number;
  factEur: number;
  /** средний срок оплаты по участкам, где он задан */
  paymentDays: number | null;
};

export type Period = { key: string; from: string; to: string } | null;

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** Дата заказа для периода и курса: начало, иначе окончание. */
export function segmentDate(row: ContractorSegmentRow): string | null {
  const trip = one(row.trips);
  const d = trip?.start_date ?? trip?.end_date ?? null;
  return d ? String(d).slice(0, 10) : null;
}

export const segmentKind = (row: ContractorSegmentRow): 'trip' | 'forwarding' =>
  one(row.trips)?.profit_mode === 'forwarding' ? 'forwarding' : 'trip';

export const isCancelled = (row: ContractorSegmentRow): boolean => one(row.trips)?.status === 'cancelled';

/**
 * Период из параметра: «all» — всё время, «YYYY» — год, «YYYY-MM» — месяц.
 * Пусто или мусор — текущий год.
 */
export function parsePeriod(raw: string | undefined, today: string): Period {
  if (raw === 'all') return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const m = /^(\d{4})-(\d{2})$/.exec(raw ?? '');
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const next = mo === 12 ? `${y + 1}-01` : `${y}-${pad(mo + 1)}`;
    return { key: `${y}-${pad(mo)}`, from: `${y}-${pad(mo)}-01`, to: `${next}-01` };
  }
  const y = /^(\d{4})$/.exec(raw ?? '')?.[1] ?? today.slice(0, 4);
  return { key: y, from: `${y}-01-01`, to: `${Number(y) + 1}-01-01` };
}

export function inPeriod(date: string | null, period: Period): boolean {
  if (!period) return true;
  return date != null && date >= period.from && date < period.to;
}

/** План участка в EUR (цена по курсу на дату заказа; без даты — на сегодня). */
export function segmentPlanEur(row: ContractorSegmentRow, rates: RateRow[], today: string): number {
  const price = Number(row.price) || 0;
  if (price <= 0) return 0;
  return eurAt(price, row.currency, segmentDate(row) ?? today, rates);
}

const empty = (): ContractorTotals => ({
  tripCount: 0,
  tripFact: 0,
  fwdCount: 0,
  fwdFact: 0,
  count: 0,
  planEur: 0,
  factEur: 0,
  paymentDays: null,
});

/**
 * Итоги по подрядчикам. factBySegment — сумма расходов «Подрядчик» по участку (EUR).
 * Участки отменённых заказов и вне периода пропускаются.
 */
export function buildContractorTotals(
  rows: ContractorSegmentRow[],
  factBySegment: Map<string, number>,
  rates: RateRow[],
  period: Period,
  today: string,
): Map<string, ContractorTotals> {
  const out = new Map<string, ContractorTotals>();
  const days = new Map<string, number[]>();
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.contractor_id || seen.has(row.id)) continue;
    if (isCancelled(row) || !inPeriod(segmentDate(row), period)) continue;
    seen.add(row.id);
    const s = out.get(row.contractor_id) ?? empty();
    const fact = factBySegment.get(row.id) ?? 0;
    if (segmentKind(row) === 'forwarding') {
      s.fwdCount += 1;
      s.fwdFact += fact;
    } else {
      s.tripCount += 1;
      s.tripFact += fact;
    }
    s.count += 1;
    s.factEur += fact;
    s.planEur += segmentPlanEur(row, rates, today);
    out.set(row.contractor_id, s);
    if (row.contractor_payment_days != null && row.contractor_payment_days > 0) {
      days.set(row.contractor_id, [...(days.get(row.contractor_id) ?? []), row.contractor_payment_days]);
    }
  }
  for (const [id, list] of days) {
    const s = out.get(id);
    if (s) s.paymentDays = Math.round(list.reduce((a, b) => a + b, 0) / list.length);
  }
  for (const s of out.values()) {
    s.factEur = Math.round(s.factEur * 100) / 100;
    s.planEur = Math.round(s.planEur * 100) / 100;
  }
  return out;
}

/** Сумма расходов «Подрядчик» по участкам. */
export function factBySegmentOf(rows: { segment_id: string | null; amount_eur: number | string | null }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (!r.segment_id) continue;
    m.set(r.segment_id, (m.get(r.segment_id) ?? 0) + (Number(r.amount_eur) || 0));
  }
  return m;
}
