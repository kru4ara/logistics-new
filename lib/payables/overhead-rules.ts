// Разбор счетов «не относится к рейсам»: категории накладных, группы по продавцу,
// подсказка по названию — чистые правила (тесты).
import { normalizeNip } from './match-rules';

export const OVERHEAD_CATEGORIES = [
  { value: 'accounting', emoji: '📒' },
  { value: 'software', emoji: '💻' },
  { value: 'vehicle_service', emoji: '🔧' },
  { value: 'vehicle_parts', emoji: '⚙️' },
  { value: 'tolls', emoji: '🛣' },
  { value: 'office', emoji: '📮' },
  { value: 'insurance', emoji: '🛡' },
  { value: 'fuel', emoji: '⛽' },
  { value: 'taxes', emoji: '🏛' },
  { value: 'salary', emoji: '👷' },
  { value: 'rent', emoji: '🏢' },
  { value: 'bank_fees', emoji: '🏦' },
  { value: 'capex', emoji: '🏗' },
  { value: 'other', emoji: '📌' },
] as const;
export type OverheadCategory = (typeof OVERHEAD_CATEGORIES)[number]['value'];
export const isOverheadCategory = (v: string | null | undefined): v is OverheadCategory =>
  OVERHEAD_CATEGORIES.some((c) => c.value === v);

export type SellerSuggestion = { assignment: 'trip' } | { assignment: 'overhead'; category: OverheadCategory };

/** Подсказка по названию продавца: агентство — к рейсам, бухгалтерия, сервис и т.п. — в накладные. */
export function guessSeller(name: string | null | undefined): SellerSuggestion | null {
  const n = (name ?? '').toLowerCase();
  if (!n) return null;
  if (/agencja\s+celna|celn[ay]\b|terminus|polbalt|im&ex/.test(n)) return { assignment: 'trip' };
  if (/biuro\s+rachunkow|ksi[eę]gow|doradca\s+podatkow/.test(n)) return { assignment: 'overhead', category: 'accounting' };
  if (/trans\.eu|logisat/.test(n)) return { assignment: 'overhead', category: 'software' };
  if (/serwis|tachograf|mitech|wostim/.test(n)) return { assignment: 'overhead', category: 'vehicle_service' };
  if (/pajero|suder|formax|[żz]erpol|cz[eę][śs]ci|motor/.test(n)) return { assignment: 'overhead', category: 'vehicle_parts' };
  if (/poczta|poligraf|everprint|wytw[óo]rnia\s+papier/.test(n)) return { assignment: 'overhead', category: 'office' };
  if (/ubezpiecz|insurance|warta|pzu|ergo\s+hestia/.test(n)) return { assignment: 'overhead', category: 'insurance' };
  return null;
}

export type IgnoredRow = {
  id: string;
  seller_nip: string | null;
  seller_name: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  gross_amount: number | null;
  net_amount: number | null;
  currency: string | null;
  paid_at: string | null;
  overhead_category?: string | null;
};

export type SellerGroup<T extends IgnoredRow = IgnoredRow> = {
  key: string;
  nip: string | null;
  name: string;
  rows: T[];
  uncategorized: number;
  /** одна категория у всех счетов группы, иначе null */
  category: string | null;
  totals: { currency: string; amount: number }[];
  lastDate: string | null;
};

/** Ключ продавца: NIP без префикса; без NIP — название. */
export const sellerKey = (r: Pick<IgnoredRow, 'seller_nip' | 'seller_name'>) =>
  normalizeNip(r.seller_nip) ?? `name:${(r.seller_name ?? '').trim().toLowerCase()}`;

/** Группы по продавцу: сначала с неразобранными счетами, внутри — по числу счетов. */
export function groupBySeller<T extends IgnoredRow>(rows: T[]): SellerGroup<T>[] {
  const m = new Map<string, T[]>();
  for (const r of rows) m.set(sellerKey(r), [...(m.get(sellerKey(r)) ?? []), r]);
  const groups = [...m].map(([key, rs]): SellerGroup<T> => {
    const sums = new Map<string, number>();
    for (const r of rs) sums.set(r.currency || 'PLN', (sums.get(r.currency || 'PLN') ?? 0) + (r.gross_amount ?? 0));
    const cats = new Set(rs.map((r) => r.overhead_category ?? null));
    const sorted = [...rs].sort((a, b) => (b.issue_date ?? '').localeCompare(a.issue_date ?? ''));
    return {
      key,
      nip: normalizeNip(rs[0].seller_nip),
      name: rs.find((r) => r.seller_name)?.seller_name ?? '—',
      rows: sorted,
      uncategorized: rs.filter((r) => !r.overhead_category).length,
      category: cats.size === 1 ? [...cats][0] : null,
      totals: [...sums].map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 })),
      lastDate: sorted[0]?.issue_date ?? null,
    };
  });
  return groups.sort(
    (a, b) => Number(b.uncategorized > 0) - Number(a.uncategorized > 0) || b.rows.length - a.rows.length || a.name.localeCompare(b.name),
  );
}
