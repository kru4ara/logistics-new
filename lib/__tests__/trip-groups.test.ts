import { describe, it, expect } from 'vitest';
import { joinError, groupEconomics, groupRole } from '../trip-groups';

const L = { id: 'L', group_id: null, truck_id: 'T', status: 'planned' };
const M = { id: 'M', group_id: null, truck_id: null, status: 'planned' };

describe('trip groups', () => {
  it('joins a plain order to a leader', () => {
    expect(joinError(L, M, 0)).toBeNull();
    expect(joinError({ ...L, group_id: 'L' }, M, 0)).toBeNull();
  });
  it('rejects bad members', () => {
    expect(joinError(L, L, 0)).toBe('self');
    expect(joinError({ ...L, group_id: 'X' }, M, 0)).toBe('leaderInGroup');
    expect(joinError(L, { ...M, group_id: 'X' }, 0)).toBe('memberInGroup');
    expect(joinError(L, { ...M, truck_id: 'T2' }, 0)).toBe('memberHasTruck');
    expect(joinError(L, M, 1)).toBe('memberHasRoute');
    expect(joinError(L, { ...M, status: 'cancelled' }, 0)).toBe('cancelled');
  });
  it('sums economics across the group', () => {
    const e = groupEconomics([{ id: 'L', revenue_eur: 1000 }, { id: 'M', revenue_eur: 800 }], { L: 1200, M: 50 });
    expect(e).toEqual({ revenue: 1800, expenses: 1250, profit: 550, orders: 2 });
  });
  it('detects role', () => {
    expect(groupRole({ id: 'L', group_id: 'L' })).toBe('leader');
    expect(groupRole({ id: 'M', group_id: 'L' })).toBe('member');
    expect(groupRole({ id: 'M', group_id: null })).toBeNull();
  });
});
