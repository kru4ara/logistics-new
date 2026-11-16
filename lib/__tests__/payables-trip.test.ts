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
