import { describe, it, expect } from 'vitest';
import { calculateStatistics } from '../statistics';

describe('calculateStatistics', () => {
  const year = 2026;

  it('возвращает нули, если данных нет', () => {
    const result = calculateStatistics({
      orders: [],
      expensesByOrder: {},
      contractorByOrder: {},
      fixedCosts: [],
      year,
    });

    expect(result.months).toHaveLength(12);
    expect(result.yearTotals.totalIncome).toBe(0);
    expect(result.yearTotals.totalExpenses).toBe(0);
    expect(result.yearTotals.profit).toBe(0);
    expect(result.avgMargin).toBe(0);
    expect(result.capexTotalForYear).toBe(0);
  });

  it('учитывает только завершённые заказы со сведёнными расходами', () => {
    const orders = [
      { id: 't1', status: 'paid', costs_closed: true, revenue_eur: 1000, end_date: '2026-05-15' },
      { id: 't2', status: 'paid', costs_closed: false, revenue_eur: 5000, end_date: '2026-05-15' },
      { id: 't3', status: 'active', costs_closed: true, revenue_eur: 7000, end_date: '2026-05-15' },
      { id: 't4', status: 'planned', costs_closed: true, revenue_eur: 9000, end_date: '2026-05-15' },
    ];

    const result = calculateStatistics({
      orders,
      expensesByOrder: { t1: 200 },
      contractorByOrder: {},
      fixedCosts: [],
      year,
    });

    const may = result.months.find((m) => m.monthKey === '2026-05')!;
    expect(may.ordersCount).toBe(1);
    expect(may.totalIncome).toBe(1000);
    expect(may.profit).toBe(800);
    expect(result.yearTotals.totalIncome).toBe(1000);
  });

  it('правильно считает доход, расходы и прибыль по заказу-рейсу', () => {
    const orders = [
      { id: 't1', status: 'paid', costs_closed: true, revenue_eur: 1000, end_date: '2026-05-15' },
      { id: 't2', status: 'paid', costs_closed: true, revenue_eur: 2000, start_date: '2026-05-10' },
    ];
    const expensesByOrder = { t1: 200, t2: 500 };

    const result = calculateStatistics({
      orders,
      expensesByOrder,
      contractorByOrder: {},
      fixedCosts: [],
      year,
    });

    const may = result.months.find((m) => m.monthKey === '2026-05')!;
    expect(may.ordersCount).toBe(2);
    expect(may.tripsCount).toBe(2);
    expect(may.tripRevenue).toBe(3000);
    expect(may.directExpenses).toBe(700);
    expect(may.totalIncome).toBe(3000);
    expect(may.totalExpenses).toBe(700);
    expect(may.profit).toBe(2300);
    expect(may.margin).toBeCloseTo(76.67, 1);

    expect(result.yearTotals.totalIncome).toBe(3000);
    expect(result.yearTotals.totalExpenses).toBe(700);
    expect(result.yearTotals.profit).toBe(2300);
    expect(result.tripProfit).toBe(2300);
    expect(result.avgProfitPerTrip).toBe(1150);
  });

  it('считает заказ-экспедирование по дате разгрузки, рейс — по финишу', () => {
    const orders = [
      {
        id: 'f1',
        status: 'paid',
        costs_closed: true,
        profit_mode: 'forwarding',
        revenue_eur: 1000,
        load_date: '2026-04-10',
        unload_date: '2026-05-20',
      },
      {
        id: 't1',
        status: 'paid',
        costs_closed: true,
        profit_mode: 'trip',
        revenue_eur: 2000,
        start_date: '2026-03-01',
        end_date: '2026-05-05',
      },
    ];

    const result = calculateStatistics({
      orders,
      expensesByOrder: {},
      contractorByOrder: {},
      fixedCosts: [],
      year,
    });

    const apr = result.months.find((m) => m.monthKey === '2026-04')!;
    const may = result.months.find((m) => m.monthKey === '2026-05')!;

    // Экспедиция загружена в апреле, выгружена в мае — идёт в мае.
    expect(may.forwardingCount).toBe(1);
    expect(may.forwardingClientSum).toBe(1000);
    expect(may.tripsCount).toBe(1);
    expect(may.tripRevenue).toBe(2000);

    expect(apr.forwardingCount).toBe(0);
    expect(apr.tripsCount).toBe(0);
  });

  it('годовую подписку (yearly) относит целиком в месяц оплаты', () => {
    const fixedCosts = [
      { id: 'fc1', amount_eur: 1200, cost_type: 'yearly', expense_date: '2026-01-15', is_capex: false },
    ];
    const result = calculateStatistics({
      orders: [],
      expensesByOrder: {},
      contractorByOrder: {},
      fixedCosts,
      year,
    });

    const jan = result.months.find((m) => m.monthKey === '2026-01')!;
    const feb = result.months.find((m) => m.monthKey === '2026-02')!;
    const dec = result.months.find((m) => m.monthKey === '2026-12')!;

    expect(jan.fixedExpenses).toBe(1200);
    expect(feb.fixedExpenses).toBe(0);
    expect(dec.fixedExpenses).toBe(0);

    expect(result.yearTotals.fixedExpenses).toBe(1200);
  });

  it('правильно считает ежемесячный (monthly) фикс-кост только в свой месяц', () => {
    const fixedCosts = [
      { id: 'fc1', amount_eur: 500, cost_type: 'monthly', month_key: '2026-03', is_capex: false },
    ];
    const result = calculateStatistics({
      orders: [],
      expensesByOrder: {},
      contractorByOrder: {},
      fixedCosts,
      year,
    });

    const march = result.months.find((m) => m.monthKey === '2026-03')!;
    const april = result.months.find((m) => m.monthKey === '2026-04')!;

    expect(march.fixedExpenses).toBe(500);
    expect(april.fixedExpenses).toBe(0);
    expect(result.yearTotals.fixedExpenses).toBe(500);
  });

  it('выносит CAPEX в отдельный список и не вычитает из прибыли', () => {
    const fixedCosts = [
      {
        id: 'fc1',
        amount_eur: 50000,
        cost_type: 'one_time',
        expense_date: '2026-04-10',
        category: 'Покупка машины',
        is_capex: true,
      },
    ];
    const result = calculateStatistics({
      orders: [],
      expensesByOrder: {},
      contractorByOrder: {},
      fixedCosts,
      year,
    });

    expect(result.capexTotalForYear).toBe(50000);
    expect(result.capexForYear).toHaveLength(1);
    expect(result.capexForYear[0].category).toBe('Покупка машины');

    const april = result.months.find((m) => m.monthKey === '2026-04')!;
    expect(april.fixedExpenses).toBe(0);
    expect(result.yearTotals.profit).toBe(0);
  });

  it('учитывает расходы подрядчика в заказе-экспедировании', () => {
    const orders = [
      {
        id: 'f1',
        status: 'invoiced',
        costs_closed: true,
        profit_mode: 'forwarding',
        revenue_eur: 5000,
        load_date: '2026-06-01',
      },
    ];
    const result = calculateStatistics({
      orders,
      expensesByOrder: { f1: 300 },
      contractorByOrder: { f1: 4000 },
      fixedCosts: [],
      year,
    });

    const june = result.months.find((m) => m.monthKey === '2026-06')!;
    expect(june.forwardingClientSum).toBe(5000);
    expect(june.forwardingContractorSum).toBe(4000);
    expect(june.forwardingExtraExpenses).toBe(300);
    expect(june.forwardingMargin).toBe(700);
    expect(june.totalExpenses).toBe(4300);
    expect(june.profit).toBe(700);
  });
});
