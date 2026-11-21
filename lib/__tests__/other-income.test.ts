import { describe, it, expect } from 'vitest';
import { incomeEurByMonth, incomeCategoryOf, isIncomeCategory } from '../other-income';
import { calculateStatistics } from '../statistics';

describe('прочие доходы', () => {
  it('суммы по месяцам; решение выписки → категория', () => {
    expect(incomeEurByMonth([{ month_key: '2026-09', amount_eur: 1000 }, { month_key: '2026-09', amount_eur: '12.5' }, { month_key: null, amount_eur: 5 }])).toEqual({ '2026-09': 1012.5 });
    expect(incomeCategoryOf('income:compensation')).toBe('compensation');
    expect(incomeCategoryOf('income:xxx')).toBe('other');
    expect(incomeCategoryOf('fuel')).toBeNull();
    expect(isIncomeCategory('refund')).toBe(true);
  });

  it('входят в доход и прибыль месяца в статистике', () => {
    const r = calculateStatistics({ orders: [], expensesByOrder: {}, contractorByOrder: {}, fixedCosts: [], otherIncome: [{ month_key: '2026-09', amount_eur: 1000 }], year: 2026 });
    const sep = r.months[8];
    expect(sep.otherIncome).toBe(1000);
    expect(sep.totalIncome).toBe(1000);
    expect(sep.profit).toBe(1000);
    expect(r.yearTotals.otherIncome).toBe(1000);
  });
});
