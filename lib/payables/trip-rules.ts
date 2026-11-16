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
