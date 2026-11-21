/**
 * Прочие доходы (миграция 045): деньги не по счёту клиента. Чистые правила, без Supabase.
 */

export const INCOME_CATEGORIES = ['compensation', 'refund', 'interest', 'insurance', 'other'] as const;
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

export function isIncomeCategory(v: unknown): v is IncomeCategory {
  return typeof v === 'string' && (INCOME_CATEGORIES as readonly string[]).includes(v);
}

/** Решение по операции выписки: overhead_category = 'income:<категория>'. */
export const INCOME_PREFIX = 'income:';
export const incomeDecision = (c: IncomeCategory) => `${INCOME_PREFIX}${c}`;
export function incomeCategoryOf(overheadCategory: string | null | undefined): IncomeCategory | null {
  if (!overheadCategory?.startsWith(INCOME_PREFIX)) return null;
  const c = overheadCategory.slice(INCOME_PREFIX.length);
  return isIncomeCategory(c) ? c : 'other';
}

export type IncomeRow = { month_key: string | null; amount_eur: number | string | null };

/** Сумма прочих доходов в EUR по месяцам (YYYY-MM). */
export function incomeEurByMonth(rows: IncomeRow[] | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows ?? []) {
    const v = Number(r.amount_eur ?? 0);
    if (!r.month_key || !Number.isFinite(v) || v === 0) continue;
    out[r.month_key] = Math.round(((out[r.month_key] ?? 0) + v) * 100) / 100;
  }
  return out;
}
