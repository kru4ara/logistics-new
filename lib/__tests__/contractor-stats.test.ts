import { describe, expect, it } from 'vitest';
import {
  buildContractorTotals,
  factBySegmentOf,
  parsePeriod,
  segmentPlanEur,
  type ContractorSegmentRow,
} from '../contractor-stats';
import type { RateRow } from '../plan-fact';

const TODAY = '2026-11-25';
const rates: RateRow[] = [
  { rate_date: '2026-01-01', pln_to_eur: 0.25, byn_to_eur: 0.3 },
  { rate_date: '2026-06-01', pln_to_eur: 0.2, byn_to_eur: 0.3 },
];

const seg = (o: Partial<ContractorSegmentRow> & { mode?: string; status?: string; date?: string | null }): ContractorSegmentRow => ({
  id: o.id ?? 's1',
  trip_id: o.trip_id ?? 't1',
  contractor_id: o.contractor_id === undefined ? 'c1' : o.contractor_id,
  price: o.price ?? 1000,
  currency: o.currency ?? 'EUR',
  contractor_payment_days: o.contractor_payment_days ?? null,
  trips: {
    status: o.status ?? 'completed',
    profit_mode: o.mode ?? 'trip',
    start_date: o.date === undefined ? '2026-03-10' : o.date,
    end_date: null,
  },
});

describe('parsePeriod', () => {
  it('всё время, год, месяц, по умолчанию — текущий год', () => {
    expect(parsePeriod('all', TODAY)).toBeNull();
    expect(parsePeriod('2025', TODAY)).toEqual({ key: '2025', from: '2025-01-01', to: '2026-01-01' });
    expect(parsePeriod('2026-12', TODAY)).toEqual({ key: '2026-12', from: '2026-12-01', to: '2027-01-01' });
    expect(parsePeriod(undefined, TODAY)).toEqual({ key: '2026', from: '2026-01-01', to: '2027-01-01' });
    expect(parsePeriod('2026-13', TODAY)?.key).toBe('2026');
    expect(parsePeriod('junk', TODAY)?.key).toBe('2026');
  });
});

describe('segmentPlanEur', () => {
  it('переводит PLN по курсу на дату заказа', () => {
    expect(segmentPlanEur(seg({ price: 4000, currency: 'PLN', date: '2026-03-10' }), rates, TODAY)).toBe(1000);
    expect(segmentPlanEur(seg({ price: 4000, currency: 'PLN', date: '2026-07-01' }), rates, TODAY)).toBe(800);
    expect(segmentPlanEur(seg({ price: 500, currency: 'EUR' }), rates, TODAY)).toBe(500);
  });
});

describe('buildContractorTotals', () => {
  it('экспедирование не считается второй раз как рейс', () => {
    const rows = [seg({ id: 'a', mode: 'forwarding' }), seg({ id: 'b', mode: 'trip' })];
    const r = buildContractorTotals(rows, new Map([['a', 900], ['b', 1100]]), rates, null, TODAY).get('c1')!;
    expect(r.fwdCount).toBe(1);
    expect(r.tripCount).toBe(1);
    expect(r.count).toBe(2);
    expect(r.fwdFact).toBe(900);
    expect(r.tripFact).toBe(1100);
    expect(r.factEur).toBe(2000);
  });

  it('один и тот же участок дважды в данных — один раз в итогах', () => {
    const rows = [seg({ id: 'a' }), seg({ id: 'a' })];
    expect(buildContractorTotals(rows, new Map([['a', 100]]), rates, null, TODAY).get('c1')!.count).toBe(1);
  });

  it('факт — из расходов, план — цена в EUR', () => {
    const rows = [seg({ id: 'a', price: 4000, currency: 'PLN' })];
    const r = buildContractorTotals(rows, new Map([['a', 1230]]), rates, null, TODAY).get('c1')!;
    expect(r.planEur).toBe(1000);
    expect(r.factEur).toBe(1230);
  });

  it('отменённые заказы и участки без подрядчика пропускаются', () => {
    const rows = [seg({ id: 'a', status: 'cancelled' }), seg({ id: 'b', contractor_id: null })];
    expect(buildContractorTotals(rows, new Map(), rates, null, TODAY).size).toBe(0);
  });

  it('период: вне периода и без даты — не считаются', () => {
    const p = parsePeriod('2026-03', TODAY);
    const rows = [seg({ id: 'a', date: '2026-03-31' }), seg({ id: 'b', date: '2026-04-01' }), seg({ id: 'c', date: null })];
    expect(buildContractorTotals(rows, new Map(), rates, p, TODAY).get('c1')!.count).toBe(1);
    expect(buildContractorTotals(rows, new Map(), rates, null, TODAY).get('c1')!.count).toBe(3);
  });

  it('средний срок оплаты — по всем участкам, где он задан', () => {
    const rows = [
      seg({ id: 'a', mode: 'trip', contractor_payment_days: 14 }),
      seg({ id: 'b', mode: 'forwarding', contractor_payment_days: 60 }),
      seg({ id: 'c', contractor_payment_days: null }),
    ];
    expect(buildContractorTotals(rows, new Map(), rates, null, TODAY).get('c1')!.paymentDays).toBe(37);
  });
});

describe('factBySegmentOf', () => {
  it('суммирует несколько расходов участка (счёт + доплата)', () => {
    const m = factBySegmentOf([
      { segment_id: 'a', amount_eur: 1000 },
      { segment_id: 'a', amount_eur: '150.5' },
      { segment_id: null, amount_eur: 99 },
    ]);
    expect(m.get('a')).toBe(1150.5);
    expect(m.size).toBe(1);
  });
});
