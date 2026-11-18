// Счёт подрядчика как расход рейса — чистые правила (тесты).
import { normalizeNip } from './match-rules';

export type TripCandidate = {
  id: string;
  number: string | null;
  clientName: string | null;
  start: string | null; // YYYY-MM-DD
  end: string | null;
  truck: string | null;
  label: string;
};

/** Сколько дней после финиша рейса ещё ждём его счёт: агентства выставляют после границы. */
export const AFTER_END_DAYS = 10;
/** И сколько до старта: EPI подают заранее. */
export const BEFORE_START_DAYS = 3;

const day = (d: string) => Math.round(Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / 86_400_000);

/**
 * Насколько дата расхода «попадает» в рейс: 0 — внутри [старт, финиш], иначе дни до
 * ближайшей границы; null — вне окна (до старта больше BEFORE_START_DAYS, после финиша
 * больше AFTER_END_DAYS) или у рейса нет дат.
 */
export function tripDistance(date: string, start: string | null, end: string | null): number | null {
  if (!start && !end) return null;
  const d = day(date);
  const s = day(start ?? end!);
  const e = day(end ?? start!);
  if (d >= s && d <= e) return 0;
  if (d < s) return s - d <= BEFORE_START_DAYS ? s - d : null;
  return d - e <= AFTER_END_DAYS ? d - e : null;
}

/** Рейсы, к которым по дате мог относиться расход: ближайшие первыми. */
export function suggestTrips(date: string | null, trips: TripCandidate[], limit = 5): TripCandidate[] {
  if (!date) return [];
  return trips
    .map((t) => ({ t, d: tripDistance(date, t.start, t.end) }))
    .filter((x): x is { t: TripCandidate; d: number } => x.d != null)
    .sort((a, b) => a.d - b.d || (b.t.start ?? '').localeCompare(a.t.start ?? ''))
    .slice(0, limit)
    .map((x) => x.t);
}

/** Поиск по списку: все слова запроса встречаются в подписи (регистр и диакритика не важны). */
export function matchesQuery(label: string, query: string): boolean {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
  const hay = norm(label);
  return norm(query).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

/**
 * Категория расхода по умолчанию: как у прошлого счёта этого продавца, иначе по названию
 * (таможенное агентство — EX-1). Не знаем — '' (пользователь выбирает сам, не «прочее»
 * молча: иначе расход теряется в «прочем»).
 */
export function defaultTripCategory(
  seller: { nip: string | null; name: string | null },
  lastByNip: Map<string, string>,
): string {
  const n = normalizeNip(seller.nip);
  if (n && lastByNip.has(n)) return lastByNip.get(n)!;
  if (/agencja\s+celna|celn[ay]/i.test(seller.name ?? '')) return 'ex1';
  return '';
}

// ── Один счёт на несколько рейсов (месячные счета агентств: Polbalt, IMEX) ──

export type Allocation = { tripId: string; amount: number };
export const MAX_SPLIT_TRIPS = 60;

const cents = (n: number) => Math.round(n * 100);

/** Поровну по копейкам: остаток — первым рейсам (сумма сходится точно). */
export function splitEvenly(total: number, n: number): number[] {
  if (n <= 0) return [];
  const all = cents(total);
  const base = Math.trunc(all / n);
  const rest = all - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < Math.abs(rest) ? Math.sign(rest) : 0)) / 100);
}

/** Прежние доли под новую сумму счёта (korekta): пропорционально, сумма сходится точно. */
export function scaleAllocations(prev: Allocation[], total: number): Allocation[] {
  const sum = prev.reduce((s, a) => s + a.amount, 0);
  if (!prev.length) return [];
  if (sum === 0) return prev.map((a, i) => ({ tripId: a.tripId, amount: splitEvenly(total, prev.length)[i] }));
  const out = prev.map((a) => ({ tripId: a.tripId, amount: Math.round((a.amount / sum) * total * 100) / 100 }));
  const diff = Math.round((total - out.reduce((s, a) => s + a.amount, 0)) * 100) / 100;
  out[0].amount = Math.round((out[0].amount + diff) * 100) / 100;
  return out;
}

export type SplitError = 'empty' | 'tooMany' | 'duplicate' | 'amount' | 'sum';

/** Доли корректны: рейсы разные, суммы > 0, в сумме — сумма счёта (±0.01). */
export function validateAllocations(total: number, allocs: Allocation[]): SplitError | null {
  if (!allocs.length) return 'empty';
  if (allocs.length > MAX_SPLIT_TRIPS) return 'tooMany';
  if (new Set(allocs.map((a) => a.tripId)).size !== allocs.length) return 'duplicate';
  if (allocs.some((a) => !Number.isFinite(a.amount) || a.amount <= 0)) return 'amount';
  if (Math.abs(cents(allocs.reduce((s, a) => s + a.amount, 0)) - cents(total)) > 1) return 'sum';
  return null;
}

/**
 * Рейсы за период месячного счёта: пересекаются с [дата − 31 дн., дата + 3 дн.] —
 * агентство выставляет счёт в конце месяца или в начале следующего.
 */
export function tripsForPeriodInvoice(date: string | null, trips: TripCandidate[]): TripCandidate[] {
  if (!date) return [];
  const d = day(date);
  const from = d - 31;
  const to = d + 3;
  return trips
    .filter((t) => {
      if (!t.start && !t.end) return false;
      const s = day(t.start ?? t.end!);
      const e = day(t.end ?? t.start!);
      return s <= to && e >= from;
    })
    .sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
}

// ── Ручные записи, которые повторяет счёт ──

export type ManualExpense = {
  id: string;
  trip_id: string;
  category: string | null;
  description: string | null;
};

/** Документы агентства (EPI, EX-1): по одному на рейс — одна категория уже повод проверить. */
const AGENCY = new Set(['epi', 'ex1']);
const norm = (s: string | null | undefined) => (s ?? '').toUpperCase().replace(/[^A-Z0-9А-ЯЁ]/g, '');
const sellerCore = (s: string | null | undefined) =>
  norm((s ?? '').replace(/\b(SP\.?\s*Z\s*O\.?\s*O\.?|SPÓŁKA|S\.A\.|LLC|LTD|GMBH)\b/gi, '')).slice(0, 8);

/**
 * Ручные расходы рейсов (без счёта), которые, похоже, и есть этот счёт: та же категория
 * (EPI ↔ EX-1 считаем одной), либо в описании — номер счёта или имя продавца. Сумму не
 * сравниваем: вручную писали нетто, округляли, делили иначе.
 */
export function findManualOverlaps(
  manual: ManualExpense[],
  tripIds: string[],
  category: string,
  sellerName: string | null,
  invoiceNumber: string | null,
): ManualExpense[] {
  const trips = new Set(tripIds);
  const num = norm(invoiceNumber);
  const seller = sellerCore(sellerName);
  return manual.filter((m) => {
    if (!trips.has(m.trip_id) || m.category === 'contractor') return false;
    // Категория сама по себе — только для документов агентства (один такой расход на рейс),
    // и именно та же: EPI и EX-1 — разные документы. Ремонт, «прочее» и т. п. в рейсе бывают
    // разные — там нужен номер счёта или продавец в описании.
    const sameCat = AGENCY.has(category) && m.category === category;
    const d = norm(m.description);
    const named = (num.length >= 4 && d.includes(num)) || (seller.length >= 4 && d.includes(seller));
    return sameCat || named;
  });
}

/** integration_state: ручные записи, которые офис признал «не дублем» счёта. */
export const NOT_DOUBLE_KEY = 'payables.notDouble';
