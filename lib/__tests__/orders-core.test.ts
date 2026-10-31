import { describe, it, expect } from 'vitest';
import {
  FORWARDING_SUFFIX,
  formatOrderNumber,
  parseOrderNumber,
  renumberOrders,
  compareOrderNumbers,
  isOrderCompleted,
  getOrderMonthKey,
  calcOrderEconomics,
} from '../orders-core';

const us = { executor_type: 'us', truck_id: 't', driver_id: 'd' };

describe('formatOrderNumber / parseOrderNumber', () => {
  it('форматирует номер по режиму', () => {
    expect(formatOrderNumber(42, 'trip')).toBe('42');
    expect(formatOrderNumber(42, 'forwarding')).toBe('42Е');
  });

  it('разбирает номер обратно', () => {
    expect(parseOrderNumber('42')).toEqual({ number: 42, isForwarding: false });
    expect(parseOrderNumber('42Е')).toEqual({ number: 42, isForwarding: true });
    expect(parseOrderNumber(null)).toEqual({ number: null, isForwarding: false });
  });
});

describe('renumberOrders', () => {
  it('нумерует плотно 1..N по дате, без дырок', () => {
    const res = renumberOrders([
      { id: 'a', start_date: '2026-01-03', created_at: '2026-01-03', ...us },
      { id: 'b', start_date: '2026-01-01', created_at: '2026-01-01', ...us },
      { id: 'c', start_date: '2026-01-02', created_at: '2026-01-02', ...us },
    ], 'trip');
    expect(res).toEqual([
      { id: 'b', trip_number: '1' },
      { id: 'c', trip_number: '2' },
      { id: 'a', trip_number: '3' },
    ]);
  });

  it('экспедиция получает суффикс Е', () => {
    const res = renumberOrders([
      { id: 'a', load_date: '2026-01-01', created_at: '2026-01-01', executor_type: 'contractor', contractor_id: 'c1' },
      { id: 'b', load_date: '2026-01-02', created_at: '2026-01-02', executor_type: 'contractor', contractor_id: 'c2' },
    ], 'forwarding');
    expect(res.map((r) => r.trip_number)).toEqual(['1Е', '2Е']);
    expect(res[0].trip_number?.endsWith(FORWARDING_SUFFIX)).toBe(true);
  });

  it('без назначенного исполнителя номер не выдаётся, счётчик не сдвигается', () => {
    const res = renumberOrders([
      { id: 'a', start_date: '2026-01-01', created_at: '2026-01-01', ...us },
      { id: 'b', start_date: '2026-01-02', created_at: '2026-01-02', executor_type: 'us', truck_id: null, driver_id: 'd' },
      { id: 'c', start_date: '2026-01-03', created_at: '2026-01-03', ...us },
    ], 'trip');
    expect(res).toEqual([
      { id: 'a', trip_number: '1' },
      { id: 'b', trip_number: null },
      { id: 'c', trip_number: '2' },
    ]);
  });

  it('подрядчик — назначенный исполнитель', () => {
    const res = renumberOrders([
      { id: 'a', start_date: '2026-01-01', created_at: '2026-01-01', executor_type: 'contractor', contractor_id: 'c1' },
    ], 'trip');
    expect(res).toEqual([{ id: 'a', trip_number: '1' }]);
  });
});

describe('compareOrderNumbers', () => {
  it('сортирует численно, а не лексикографически', () => {
    expect(['10', '2', '1'].sort(compareOrderNumbers)).toEqual(['1', '2', '10']);
  });

  it('заказы без номера уходят в конец', () => {
    expect(['2', null, '1'].sort(compareOrderNumbers)).toEqual(['1', '2', null]);
  });
});

describe('isOrderCompleted', () => {
  it('завершённые: paid и invoiced со сведёнными расходами', () => {
    expect(isOrderCompleted({ status: 'paid', costs_closed: true })).toBe(true);
    expect(isOrderCompleted({ status: 'invoiced', costs_closed: true })).toBe(true);
  });

  it('незавершённые: active, planned, без статуса', () => {
    expect(isOrderCompleted({ status: 'active', costs_closed: true })).toBe(false);
    expect(isOrderCompleted({ status: 'planned', costs_closed: true })).toBe(false);
    expect(isOrderCompleted({ status: null, costs_closed: true })).toBe(false);
  });

  it('расходы не сведены — в статистику не идёт', () => {
    expect(isOrderCompleted({ status: 'paid', costs_closed: false })).toBe(false);
    expect(isOrderCompleted({ status: 'paid', costs_closed: null })).toBe(false);
  });
});

describe('getOrderMonthKey', () => {
  it('рейс: месяц по end_date, иначе start_date', () => {
    expect(getOrderMonthKey({ profit_mode: 'trip', start_date: '2026-01-05', end_date: '2026-02-10' })).toBe('2026-02');
    expect(getOrderMonthKey({ profit_mode: 'trip', start_date: '2026-01-05', end_date: null })).toBe('2026-01');
  });

  it('экспедиция: месяц по load_date, иначе unload_date', () => {
    expect(getOrderMonthKey({ profit_mode: 'forwarding', load_date: '2026-05-07', unload_date: '2026-05-12' })).toBe('2026-05');
    expect(getOrderMonthKey({ profit_mode: 'forwarding', load_date: null, unload_date: '2026-06-12' })).toBe('2026-06');
  });

  it('без дат — null', () => {
    expect(getOrderMonthKey({ profit_mode: 'trip' })).toBeNull();
  });
});

describe('calcOrderEconomics', () => {
  it('прибыль = выручка − подрядчики − прочие расходы', () => {
    const r = calcOrderEconomics({ revenue: 1000, contractorExpenses: 600, otherExpenses: 100 });
    expect(r.profit).toBe(300);
    expect(r.marginPct).toBeCloseTo(30);
  });

  it('null и мусор не ломают расчёт', () => {
    const r = calcOrderEconomics({
      revenue: null as unknown as number,
      contractorExpenses: NaN,
      otherExpenses: undefined as unknown as number,
    });
    expect(r.profit).toBe(0);
    expect(r.marginPct).toBe(0);
  });
});
