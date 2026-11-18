import { describe, it, expect } from 'vitest';
import { tripDistance, suggestTrips, matchesQuery, defaultTripCategory, type TripCandidate } from '../payables/trip-rules';

const trip = (id: string, start: string | null, end: string | null): TripCandidate => ({
  id, number: id, clientName: null, start, end, truck: null, label: id,
});

describe('рейс по дате расхода', () => {
  it('внутри периода — 0, рядом — дни, далеко — нет', () => {
    expect(tripDistance('2026-11-10', '2026-11-08', '2026-11-14')).toBe(0);
    expect(tripDistance('2026-11-16', '2026-11-08', '2026-11-14')).toBe(2); // счёт после финиша
    expect(tripDistance('2026-11-06', '2026-11-08', '2026-11-14')).toBe(2); // EPI заранее
    expect(tripDistance('2026-11-30', '2026-11-08', '2026-11-14')).toBeNull();
    expect(tripDistance('2026-11-01', '2026-11-08', '2026-11-14')).toBeNull();
    expect(tripDistance('2026-11-10', null, null)).toBeNull();
    expect(tripDistance('2026-11-10', '2026-11-10', null)).toBe(0); // рейс без финиша
  });

  it('ближайшие рейсы первыми (перегруз Piekut 16.11)', () => {
    const s = suggestTrips('2026-11-16', [
      trip('old', '2026-10-01', '2026-10-05'),
      trip('after', '2026-11-05', '2026-11-12'),
      trip('inside', '2026-11-14', '2026-11-18'),
    ]);
    expect(s.map((t) => t.id)).toEqual(['inside', 'after']);
    expect(suggestTrips(null, [trip('a', '2026-11-14', '2026-11-18')])).toEqual([]);
  });
});

describe('поиск и категория', () => {
  it('поиск по словам без регистра и диакритики', () => {
    const label = '№6872 · Radpol · Łódź → Mińsk · 09.11.2026';
    expect(matchesQuery(label, '6872')).toBe(true);
    expect(matchesQuery(label, 'lodz minsk')).toBe(true);
    expect(matchesQuery(label, 'RADPOL 6872')).toBe(true);
    expect(matchesQuery(label, 'radpol 999')).toBe(false);
    expect(matchesQuery(label, '')).toBe(true);
  });

  it('категория: как в прошлый раз, агентство — EX-1, иначе выбрать вручную', () => {
    const last = new Map([['5422749941', 'epi']]);
    expect(defaultTripCategory({ nip: 'PL5422749941', name: 'AGENCJA CELNA TERMINUS' }, last)).toBe('epi');
    expect(defaultTripCategory({ nip: '8212544631', name: '"A.T. TRADING" Agencja Celna' }, last)).toBe('ex1');
    expect(defaultTripCategory({ nip: '8212659541', name: 'FIRMA HANDLOWO-USŁUGOWA Krzysztof Piekut' }, last)).toBe('');
  });
});

import { summarizePayables, type PayableRow } from '../payables/summary';
describe('сводка: счёт-расход рейса', () => {
  it('привязанный к рейсу — не «требует привязки»', () => {
    const base: PayableRow = { id: 'x', ksef_number: 'k', invoice_number: '36/11/26/PR', issue_date: '2026-11-16', seller_nip: '8212659541', seller_name: 'Piekut',
      net_amount: 100, gross_amount: 123, currency: 'EUR', payment_due: '2026-11-23', description: null, segment_id: null, match_status: 'none', paid_at: null };
    expect(summarizePayables([base], '2026-11-17').unmatched).toHaveLength(1);
    const s = summarizePayables([{ ...base, trip_id: 't1', match_status: 'manual' }], '2026-11-17');
    expect(s.unmatched).toHaveLength(0);
    expect(s.toPay.map((r) => r.id)).toEqual(['x']);
  });
});

import { splitEvenly, scaleAllocations, validateAllocations, findManualOverlaps, tripsForPeriodInvoice } from '../payables/trip-rules';
describe('один счёт на несколько рейсов', () => {
  it('поровну по копейкам, сумма сходится', () => {
    expect(splitEvenly(440, 3)).toEqual([146.67, 146.67, 146.66]);
    expect(splitEvenly(100, 4)).toEqual([25, 25, 25, 25]);
    expect(splitEvenly(0.01, 2)).toEqual([0.01, 0]);
    expect(splitEvenly(10, 0)).toEqual([]);
  });

  it('пропорционально новой сумме (korekta)', () => {
    const s = scaleAllocations([{ tripId: 'a', amount: 300 }, { tripId: 'b', amount: 100 }], 440);
    expect(s).toEqual([{ tripId: 'a', amount: 330 }, { tripId: 'b', amount: 110 }]);
    const r = scaleAllocations([{ tripId: 'a', amount: 1 }, { tripId: 'b', amount: 1 }, { tripId: 'c', amount: 1 }], 100);
    expect(r.reduce((x, a) => x + a.amount, 0)).toBeCloseTo(100, 5);
  });

  it('проверка долей', () => {
    const ok = [{ tripId: 'a', amount: 220 }, { tripId: 'b', amount: 220 }];
    expect(validateAllocations(440, ok)).toBeNull();
    expect(validateAllocations(440, [])).toBe('empty');
    expect(validateAllocations(440, [{ tripId: 'a', amount: 220 }, { tripId: 'a', amount: 220 }])).toBe('duplicate');
    expect(validateAllocations(440, [{ tripId: 'a', amount: 440 }, { tripId: 'b', amount: 0 }])).toBe('amount');
    expect(validateAllocations(440, [{ tripId: 'a', amount: 200 }, { tripId: 'b', amount: 220 }])).toBe('sum');
    expect(validateAllocations(440, [{ tripId: 'a', amount: 220.005 }, { tripId: 'b', amount: 220 }])).toBeNull();
  });

  it('рейсы месяца для счёта Polbalt от 31.10', () => {
    const t = (id: string, s: string, e: string) => ({ id, number: id, clientName: null, start: s, end: e, truck: null, label: id });
    const r = tripsForPeriodInvoice('2026-10-31', [
      t('sep', '2026-09-10', '2026-09-20'),
      t('edge', '2026-09-28', '2026-10-02'),
      t('oct', '2026-10-15', '2026-10-20'),
      t('nov', '2026-11-05', '2026-11-08'),
    ]);
    expect(r.map((x) => x.id)).toEqual(['edge', 'oct']);
  });
});

describe('ручные записи, которые повторяет счёт', () => {
  const m = (id: string, trip_id: string, category: string | null, description: string | null = null) => ({ id, trip_id, category, description });
  const manual = [
    m('a', '905', 'epi', 'EPI'),
    m('b', 'arm1', 'ex1', null), // EX-1 ↔ EPI — одно агентство
    m('c', '905', 'fuel', 'ORLEN'),
    m('d', '6788', 'epi', 'EPI'), // рейс не выбран
    m('e', '134638', 'other', 'Polbalt F/0045/KO/10/2026'), // по номеру
    m('f', '134638', 'contractor', 'POLBALT'), // участок перевозчика — не трогаем
  ];
  it('категория, EPI ↔ EX-1, номер или продавец в описании; только выбранные рейсы', () => {
    const r = findManualOverlaps(manual, ['905', 'arm1', '134638'], 'epi', 'POLBALT SP. Z O.O.', 'F/0045/KO/10/2026');
    expect(r.map((x) => x.id)).toEqual(['a', 'b', 'e']);
  });
  it('по имени продавца без категории', () => {
    expect(findManualOverlaps([m('x', '1', 'other', 'оплата Polbalt за EX')], ['1'], 'epi', 'POLBALT SP. Z O.O.', null).map((x) => x.id)).toEqual(['x']);
  });
  it('ремонт / прочее: одна категория — ещё не дубль (WEA HOLDING и «ад блю», «фильтр салона»)', () => {
    const r = findManualOverlaps([m('p', '1', 'repair', 'ад блю'), m('q', '1', 'repair', 'фильтр салона')], ['1'], 'repair', 'WEA HOLDING Polska Sp.z o.o.', '21/26/U-O');
    expect(r).toEqual([]);
  });
});
