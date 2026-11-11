import { describe, it, expect } from 'vitest';
import {
  isScoped,
  managerTripFilter,
  tripVisibleToScope,
  filterTripsByScope,
  type Scope,
} from '../scope-rules';

const office: Scope = { kind: 'office' };
const managerA: Scope = { kind: 'manager', managerId: 'mgr-A' };
const driver: Scope = { kind: 'driver', driverId: 'drv-1' };

describe('isScoped', () => {
  it('ограничен только менеджер', () => {
    expect(isScoped(managerA)).toBe(true);
    expect(isScoped(office)).toBe(false);
    expect(isScoped(driver)).toBe(false);
  });
});

describe('managerTripFilter', () => {
  it('менеджеру — «без менеджера ИЛИ мой»', () => {
    expect(managerTripFilter(managerA)).toBe('manager_id.is.null,manager_id.eq.mgr-A');
  });

  it('офису и водителю фильтр не нужен', () => {
    expect(managerTripFilter(office)).toBeNull();
    expect(managerTripFilter(driver)).toBeNull();
  });
});

describe('tripVisibleToScope', () => {
  it('менеджер видит заказ, назначенный на него', () => {
    expect(tripVisibleToScope(managerA, { manager_id: 'mgr-A' })).toBe(true);
  });

  it('менеджер видит неназначенный заказ (общий пул)', () => {
    expect(tripVisibleToScope(managerA, { manager_id: null })).toBe(true);
    expect(tripVisibleToScope(managerA, {})).toBe(true);
  });

  it('менеджер НЕ видит заказ другого менеджера', () => {
    expect(tripVisibleToScope(managerA, { manager_id: 'mgr-B' })).toBe(false);
  });

  it('офис видит всё', () => {
    expect(tripVisibleToScope(office, { manager_id: 'mgr-B' })).toBe(true);
    expect(tripVisibleToScope(office, null)).toBe(true);
  });

  it('отсутствующий заказ не виден менеджеру', () => {
    expect(tripVisibleToScope(managerA, null)).toBe(false);
  });
});

describe('filterTripsByScope', () => {
  const trips = [
    { id: '1', manager_id: 'mgr-A' },
    { id: '2', manager_id: null },
    { id: '3', manager_id: 'mgr-B' },
  ];

  it('менеджеру остаются свои и неназначенные', () => {
    const visible = filterTripsByScope(managerA, trips);
    expect(visible.map((t) => t.id)).toEqual(['1', '2']);
  });

  it('офису остаётся всё', () => {
    expect(filterTripsByScope(office, trips)).toHaveLength(3);
  });

  it('водителю скоуп не трогает (у него RLS)', () => {
    expect(filterTripsByScope(driver, trips)).toHaveLength(3);
  });

  it('пустой список не ломается', () => {
    expect(filterTripsByScope(managerA, [])).toEqual([]);
  });
});
