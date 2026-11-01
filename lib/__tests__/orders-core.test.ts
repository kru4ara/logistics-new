import { describe, it, expect } from 'vitest';
import {
  FORWARDING_SUFFIX,
  formatOrderNumber,
  parseOrderNumber,
  renumberOrders,
  orderByNumberingDate,
  getOrderUnloadDateStrict,
  compareOrderNumbers,
  isOrderCompleted,
  hasUnloadDate,
  isOrderMissingUnloadDate,
  getOrderMonthKey,
  calcOrderEconomics,
  deriveProfitMode,
} from '../orders-core';

/** Сегмент с нашей машиной: машина + водитель. */
const usSeg = { executor_type: 'us', truck_id: 't', driver_id: 'd' };
/** Сегмент с подрядчиком. */
const conSeg = { executor_type: 'contractor', contractor_id: 'c1' };
/** Заказ с нашей машиной (один сегмент). */
const us = { segments: [usSeg] };

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
      { id: 'a', profit_mode: 'forwarding', load_date: '2026-01-01', created_at: '2026-01-01', segments: [conSeg] },
      { id: 'b', profit_mode: 'forwarding', load_date: '2026-01-02', created_at: '2026-01-02', segments: [{ executor_type: 'contractor', contractor_id: 'c2' }] },
    ], 'forwarding');
    expect(res.map((r) => r.trip_number)).toEqual(['1Е', '2Е']);
    expect(res[0].trip_number?.endsWith(FORWARDING_SUFFIX)).toBe(true);
  });

  it('без назначенного исполнителя номер не выдаётся, счётчик не сдвигается', () => {
    const res = renumberOrders([
      { id: 'a', start_date: '2026-01-01', created_at: '2026-01-01', ...us },
      { id: 'b', start_date: '2026-01-02', created_at: '2026-01-02', segments: [{ executor_type: 'us', truck_id: null, driver_id: 'd' }] },
      { id: 'c', start_date: '2026-01-03', created_at: '2026-01-03', ...us },
    ], 'trip');
    expect(res).toEqual([
      { id: 'a', trip_number: '1' },
      { id: 'b', trip_number: null },
      { id: 'c', trip_number: '2' },
    ]);
  });

  it('подрядчик без нашей машины — назначенный исполнитель', () => {
    const res = renumberOrders([
      { id: 'a', profit_mode: 'forwarding', start_date: '2026-01-01', created_at: '2026-01-01', segments: [conSeg] },
    ], 'forwarding');
    expect(res).toEqual([{ id: 'a', trip_number: '1Е' }]);
  });

  it('смешанный заказ (наш транспорт + подрядчик) остаётся в ветке рейсов', () => {
    const res = renumberOrders([
      { id: 'a', start_date: '2026-01-01', created_at: '2026-01-01', segments: [usSeg, conSeg] },
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
  it('рейс: месяц по end_date (финиш), иначе start_date', () => {
    expect(getOrderMonthKey({ profit_mode: 'trip', start_date: '2026-01-05', end_date: '2026-02-10' })).toBe('2026-02');
    expect(getOrderMonthKey({ profit_mode: 'trip', start_date: '2026-01-05', end_date: null })).toBe('2026-01');
  });

  it('экспедиция: месяц по unload_date (разгрузка), иначе load_date', () => {
    // Загружен в сентябре, выгружен в октябре — заказ октябрьский.
    expect(getOrderMonthKey({ profit_mode: 'forwarding', load_date: '2026-09-07', unload_date: '2026-10-12' })).toBe('2026-10');
    expect(getOrderMonthKey({ profit_mode: 'forwarding', load_date: '2026-05-07', unload_date: '2026-05-12' })).toBe('2026-05');
    expect(getOrderMonthKey({ profit_mode: 'forwarding', load_date: null, unload_date: '2026-06-12' })).toBe('2026-06');
    // Без разгрузки — запасной вариант по загрузке.
    expect(getOrderMonthKey({ profit_mode: 'forwarding', load_date: '2026-07-03', unload_date: null })).toBe('2026-07');
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

describe('hasUnloadDate', () => {
  it('рейс: дата выгрузки — финиш', () => {
    expect(hasUnloadDate({ profit_mode: 'trip', end_date: '2026-10-10' })).toBe(true);
  });

  it('рейс без финиша — даты выгрузки нет (в пути)', () => {
    expect(hasUnloadDate({ profit_mode: 'trip', end_date: null })).toBe(false);
  });

  it('экспедиция: дата выгрузки — разгрузка', () => {
    expect(hasUnloadDate({ profit_mode: 'forwarding', unload_date: '2026-10-10' })).toBe(true);
  });

  it('экспедиция без разгрузки — даты выгрузки нет', () => {
    expect(hasUnloadDate({ profit_mode: 'forwarding', unload_date: null })).toBe(false);
  });

  it('запасной вариант (start_date / load_date) датой выгрузки НЕ считается', () => {
    expect(hasUnloadDate({ profit_mode: 'trip', start_date: '2026-10-10', end_date: null })).toBe(false);
    expect(hasUnloadDate({ profit_mode: 'forwarding', load_date: '2026-10-10', unload_date: null })).toBe(false);
  });

  it('пустой заказ и null — без даты выгрузки', () => {
    expect(hasUnloadDate(null)).toBe(false);
    expect(hasUnloadDate({})).toBe(false);
  });
});

describe('isOrderMissingUnloadDate', () => {
  it('заказ без даты выгрузки — в пути', () => {
    expect(isOrderMissingUnloadDate({ profit_mode: 'trip', end_date: null })).toBe(true);
  });

  it('заказ с датой выгрузки — не в пути', () => {
    expect(isOrderMissingUnloadDate({ profit_mode: 'trip', end_date: '2026-10-10' })).toBe(false);
  });
});

describe('нумерация по дате выгрузки (строго)', () => {
  it('дата выгрузки берётся строго: рейс — финиш, экспедиция — разгрузка', () => {
    expect(getOrderUnloadDateStrict({ profit_mode: 'trip', end_date: '2026-10-29' })).toBe('2026-10-29');
    expect(getOrderUnloadDateStrict({ profit_mode: 'forwarding', unload_date: '2026-10-28' })).toBe('2026-10-28');
  });

  it('запасной вариант (start_date / load_date) не подставляется', () => {
    expect(getOrderUnloadDateStrict({ profit_mode: 'trip', start_date: '2026-10-29', end_date: null })).toBeNull();
    expect(getOrderUnloadDateStrict({ profit_mode: 'forwarding', load_date: '2026-10-27', unload_date: null })).toBeNull();
  });

  it('заказ в пути уходит в конец ветки и получает наибольший номер', () => {
    const res = renumberOrders([
      { id: 'inTransit', start_date: '2026-10-29', created_at: '2026-10-14', ...us },
      { id: 'done', end_date: '2026-10-29', created_at: '2026-10-23', ...us },
      { id: 'done2', end_date: '2026-10-25', created_at: '2026-10-20', ...us },
    ], 'trip');
    expect(res).toEqual([
      { id: 'done2', trip_number: '1' },
      { id: 'done', trip_number: '2' },
      { id: 'inTransit', trip_number: '3' },
    ]);
  });

  it('рейс в пути не обгоняет завершённый рейс с более поздним финишем', () => {
    const res = renumberOrders([
      { id: 'a', start_date: '2026-10-29', created_at: '2026-10-14', ...us },
      { id: 'b', end_date: '2026-10-29', created_at: '2026-10-23', ...us },
    ], 'trip');
    const map = Object.fromEntries(res.map((r) => [r.id, r.trip_number]));
    expect(map.a).toBe('2');
    expect(map.b).toBe('1');
  });

  it('экспедиция в пути уходит в конец своей ветки', () => {
    const res = renumberOrders([
      { id: 'fwdInTransit', profit_mode: 'forwarding', load_date: '2026-10-27', created_at: '2026-10-14', segments: [conSeg] },
      { id: 'fwdDone', profit_mode: 'forwarding', unload_date: '2026-10-28', created_at: '2026-10-20', segments: [{ executor_type: 'contractor', contractor_id: 'c2' }] },
    ], 'forwarding');
    const map = Object.fromEntries(res.map((r) => [r.id, r.trip_number]));
    expect(map.fwdDone).toBe('1Е');
    expect(map.fwdInTransit).toBe('2Е');
  });

  it('сортировка нумерации: без даты выгрузки — в конец', () => {
    const inTransit = { start_date: '2026-10-01', created_at: '2026-10-01' };
    const done = { end_date: '2026-10-29', created_at: '2026-10-05' };
    expect(orderByNumberingDate(inTransit as any, done as any)).toBe(1);
    expect(orderByNumberingDate(done as any, inTransit as any)).toBe(-1);
  });

  it('оба без даты выгрузки — порядок по дате создания', () => {
    const a = { created_at: '2026-10-01' };
    const b = { created_at: '2026-10-05' };
    expect(orderByNumberingDate(a as any, b as any)).toBe(-1);
    expect(orderByNumberingDate(b as any, a as any)).toBe(1);
  });
});

describe('deriveProfitMode', () => {
  it('наш транспорт -> рейс', () => {
    expect(deriveProfitMode([usSeg])).toBe('trip');
  });

  it('только подрядчик -> экспедирование', () => {
    expect(deriveProfitMode([conSeg])).toBe('forwarding');
  });

  it('смешанный заказ -> рейс', () => {
    expect(deriveProfitMode([usSeg, conSeg])).toBe('trip');
  });

  it('без сегментов -> режим не определён', () => {
    expect(deriveProfitMode([])).toBeNull();
    expect(deriveProfitMode(null)).toBeNull();
  });

  it('наша машина без водителя не считается назначенным исполнителем', () => {
    expect(deriveProfitMode([{ executor_type: 'us', truck_id: 't', driver_id: null }])).toBeNull();
  });

  it('подрядчик без contractor_id не считается назначенным', () => {
    expect(deriveProfitMode([{ executor_type: 'contractor', contractor_id: null }])).toBeNull();
  });
});
