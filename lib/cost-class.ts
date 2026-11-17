// Тип общего расхода: операционный (в прибыль) или вне P&L — вывод собственникам
// (дивиденды) и снятие наличных. Инвестиции — отдельный признак is_capex.

export const COST_CLASSES = ['operating', 'dividends', 'cash'] as const;
export type CostClass = (typeof COST_CLASSES)[number];

export const isCostClass = (v: unknown): v is CostClass => COST_CLASSES.includes(v as CostClass);

/** Строка из базы → тип; до миграции 043 колонки нет — операционный. */
export const costClassOf = (fc: { cost_class?: string | null }): CostClass => (isCostClass(fc.cost_class) ? fc.cost_class : 'operating');

/** Идёт ли расход в прибыль: не инвестиция и не вне P&L. */
export const isOperatingCost = (fc: { is_capex?: boolean | null; cost_class?: string | null }) =>
  fc.is_capex !== true && costClassOf(fc) === 'operating';

/** Подсказка по тексту записи: «Дивиденты на 3х по 500» → дивиденды. */
export function guessCostClass(category: string | null | undefined): CostClass {
  return /дивиден|дивіден|dywidend|dividend/i.test(category ?? '') ? 'dividends' : 'operating';
}
