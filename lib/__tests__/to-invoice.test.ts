import { describe, it, expect } from 'vitest';
import { buildToInvoice, firstCmrByTrip } from '../to-invoice';

const trip = (id: string, status: string, end: string | null, rev = 1000) => ({
  id,
  trip_number: id,
  client_id: 'c',
  status,
  end_date: end,
  revenue_eur: rev,
});

describe('к выставлению', () => {
  it('первый CMR и их число', () => {
    const m = firstCmrByTrip([
      { trip_id: 'a', uploaded_at: '2026-11-10T10:00:00Z' },
      { trip_id: 'a', uploaded_at: '2026-11-08T10:00:00Z' },
      { trip_id: null, uploaded_at: '2026-11-01' },
    ]);
    expect(m.get('a')).toEqual({ at: '2026-11-08T10:00:00Z', count: 2 });
    expect(m.size).toBe(1);
  });

  it('CMR есть — можно выставлять; завершён без CMR — ждём; в пути без CMR и со счётом — нет', () => {
    const cmr = firstCmrByTrip([
      { trip_id: 'ready-active', uploaded_at: '2026-11-14T08:00:00Z' },
      { trip_id: 'ready-old', uploaded_at: '2026-11-01T08:00:00Z' },
      { trip_id: 'invoiced', uploaded_at: '2026-11-01T08:00:00Z' },
    ]);
    const list = buildToInvoice(
      [
        trip('ready-active', 'active', null, 900),
        trip('ready-old', 'completed', '2026-10-30', 1100.5),
        trip('invoiced', 'invoiced', '2026-10-30'),
        trip('on-road', 'active', null),
        trip('no-cmr', 'completed', '2026-11-06'),
        trip('planned', 'planned', null),
      ],
      cmr,
      '2026-11-16',
    );
    expect(list.ready.map((r) => r.id)).toEqual(['ready-old', 'ready-active']);
    expect(list.ready[0]).toMatchObject({ waitingDays: 15, cmrCount: 1 });
    expect(list.readyTotal).toBe(2000.5);
    expect(list.noCmr.map((r) => r.id)).toEqual(['no-cmr']);
    expect(list.noCmr[0].waitingDays).toBe(10);
  });
});

import { completionBlock } from '../to-invoice';

describe('завершение рейса без CMR', () => {
  it('водителю — нельзя, офису — можно, другие статусы — можно', () => {
    expect(completionBlock({ status: 'completed', isDriver: true, cmrCount: 0 })).toBe('needCmr');
    expect(completionBlock({ status: 'completed', isDriver: true, cmrCount: 1 })).toBeNull();
    expect(completionBlock({ status: 'completed', isDriver: false, cmrCount: 0 })).toBeNull();
    expect(completionBlock({ status: 'active', isDriver: true, cmrCount: 0 })).toBeNull();
  });
});
