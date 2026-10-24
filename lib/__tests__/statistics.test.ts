import { describe, it, expect } from 'vitest';
import { calculateStatistics } from '../statistics';

describe('calculateStatistics', () => {
  const year = 2026;

  it('возвращает нули, если данных нет', () => {
    const result = calculateStatistics({
      trips: [],
      allExpenses: [],
      fixedCosts: [],
      forwarding: [],
      contractorsByForwarding: {},
      expensesByForwarding: {},
      year,
    });

    expect(result.months).toHaveLength(12);
    expect(result.yearTotals.totalIncome).toBe(0);
    expect(result.yearTotals.totalExpenses).toBe(0);
    expect(result.yearTotals.profit).toBe(0);
    expect(result.avgMargin).toBe(0);
    expect(result.capexTotalForYear).toBe(0);
  });

  it('правильно считает доход, расходы и прибыль по рейсу', () => {
    const trips = [
      { id: 't1', revenue_eur: 1000, end_date: '2026-05-15' },
      { id: 't2', revenue_eur: 2000, start_date: '2026-05-10' }, // без финиша, берём старт
    ];
    const allExpenses = [
      { trip_id: 't1', amount_eur: 200 },
      { trip_id: 't2', amount_eur: 500 },
    ];
    const result = calculateStatistics({
      trips,
      allExpenses,
      fixedCosts: [],
      forwarding: [],
      contractorsByForwarding: {},
      expensesByForwarding: {},
      year,
    });

    // Май (month 5)
    const may = result.months.find(m => m.monthKey === '2026-05')!;
    expect(may.tripsCount).toBe(2);
    expect(may.tripRevenue).toBe(3000);
    expect(may.directExpenses).toBe(700);
    expect(may.totalIncome).toBe(3000);
    expect(may.totalExpenses).toBe(700);
    expect(may.profit).toBe(2300);
    expect(may.margin).toBeCloseTo(76.67, 1); // 2300 / 3000 * 100

    // Итоги
    expect(result.yearTotals.totalIncome).toBe(3000);
    expect(result.yearTotals.totalExpenses).toBe(700);
    expect(result.yearTotals.profit).toBe(2300);
    expect(result.tripProfit).toBe(2300);
    expect(result.avgProfitPerTrip).toBe(1150);
  });

  it('правильно считает годовую подписку (yearly) как 1/12 каждый месяц', () => {
    // Годовой расход 1200 € начался в январе 2026
    const fixedCosts = [
      { id: 'fc1', amount_eur: 1200, cost_type: 'yearly', expense_date: '2026-01-15', is_capex: false },
    ];
    const result = calculateStatistics({
      trips: [],
      allExpenses: [],
      fixedCosts,
      forwarding: [],
      contractorsByForwarding: {},
      expensesByForwarding: {},
      year,
    });

    // Каждый месяц должен получить по 100 €
    const jan = result.months.find(m => m.monthKey === '2026-01')!;
    const feb = result.months.find(m => m.monthKey === '2026-02')!;
    const dec = result.months.find(m => m.monthKey === '2026-12')!;

    expect(jan.fixedExpenses).toBe(100);
    expect(feb.fixedExpenses).toBe(100);
    expect(dec.fixedExpenses).toBe(100);

    // Итого за год 1200
    expect(result.yearTotals.fixedExpenses).toBe(1200);
  });

  it('правильно считает ежемесячный (monthly) фикс-кост только в свой месяц', () => {
    const fixedCosts = [
      { id: 'fc1', amount_eur: 500, cost_type: 'monthly', month_key: '2026-03', is_capex: false },
    ];
    const result = calculateStatistics({
      trips: [],
      allExpenses: [],
      fixedCosts,
      forwarding: [],
      contractorsByForwarding: {},
      expensesByForwarding: {},
      year,
    });

    const march = result.months.find(m => m.monthKey === '2026-03')!;
    const april = result.months.find(m => m.monthKey === '2026-04')!;

    expect(march.fixedExpenses).toBe(500);
    expect(april.fixedExpenses).toBe(0);
    expect(result.yearTotals.fixedExpenses).toBe(500);
  });

  it('выносит CAPEX в отдельный список и не вычитает из прибыли', () => {
    const fixedCosts = [
      { id: 'fc1', amount_eur: 50000, cost_type: 'one_time', expense_date: '2026-04-10', category: 'Покупка машины', is_capex: true },
    ];
    const result = calculateStatistics({
      trips: [],
      allExpenses: [],
      fixedCosts,
      forwarding: [],
      contractorsByForwarding: {},
      expensesByForwarding: {},
      year,
    });

    // Не должно попасть в операционные расходы
    expect(result.yearTotals.totalExpenses).toBe(0);
    expect(result.yearTotals.profit).toBe(0);

    // Должно быть в CAPEX
    expect(result.capexTotalForYear).toBe(50000);
    expect(result.capexForYear).toHaveLength(1);
    expect(result.capexForYear[0].category).toBe('Покупка машины');
  });

  it('правильно считает маржу экспедирования', () => {
    const forwarding = [
      { id: 'f1', client_price_eur: 1000, load_date: '2026-06-01' },
    ];
    const contractorsByForwarding = { f1: 600 };
    const expensesByForwarding = { f1: 100 };

    const result = calculateStatistics({
      trips: [],
      allExpenses: [],
      fixedCosts: [],
      forwarding,
      contractorsByForwarding,
      expensesByForwarding,
      year,
    });

    const june = result.months.find(m => m.monthKey === '2026-06')!;
    expect(june.forwardingCount).toBe(1);
    expect(june.forwardingClientSum).toBe(1000);
    expect(june.forwardingContractorSum).toBe(600);
    expect(june.forwardingExtraExpenses).toBe(100);
    expect(june.forwardingMargin).toBe(300); // 1000 - 600 - 100
    expect(june.totalIncome).toBe(1000);
    expect(june.totalExpenses).toBe(700);
    expect(june.profit).toBe(300);
  });
});
