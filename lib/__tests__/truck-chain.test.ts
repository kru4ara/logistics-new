import { describe, it, expect } from 'vitest';
import { findChainIssues, type ChainTrip } from '../truck-chain';

const t = (id: string, s: string | null, e: string | null, o: Partial<ChainTrip> = {}): ChainTrip => ({
  id, truck_id: 'T1', start_date: s, end_date: e, status: 'completed', profit_mode: 'trip', ...o,
});

describe('цепочка рейсов машины', () => {
  it('без дыр — пусто; дыра и пересечение находятся', () => {
    expect(findChainIssues([t('a', '2026-11-01', '2026-11-05'), t('b', '2026-11-06', '2026-11-10')])).toEqual([]);
    const r = findChainIssues([t('a', '2026-11-01', '2026-11-05'), t('b', '2026-11-10', '2026-11-15'), t('c', '2026-11-14', '2026-11-20')]);
    expect(r.map((x) => [x.nextId, x.kind, x.days, x.expectedStart])).toEqual([
      ['b', 'gap', 4, '2026-11-06'],
      ['c', 'overlap', -2, '2026-11-16'],
    ]);
  });

  it('экспедиция, отменённые и другие машины не в цепочке; старт не позже финиша', () => {
    const r = findChainIssues([
      t('a', '2026-11-01', '2026-11-05'),
      t('f', '2026-11-02', '2026-11-03', { profit_mode: 'forwarding' }),
      t('x', '2026-11-20', '2026-11-21', { status: 'cancelled' }),
      t('o', '2026-11-20', '2026-11-21', { truck_id: 'T2' }),
      t('b', '2026-11-06', '2026-11-08'),
      t('c', null, null, { status: 'planned' }),
    ]);
    expect(r.map((x) => [x.nextId, x.kind, x.expectedStart])).toEqual([['c', 'noStart', '2026-11-09']]);
  });
});
