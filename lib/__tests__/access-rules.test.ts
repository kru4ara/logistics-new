import { describe, it, expect } from 'vitest';
import {
  actorOwnsTrip,
  evaluateTripAccess,
  evaluateExpenseAccess,
  type ActorState,
} from '../access-rules';

const office: ActorState = { role: 'office', driverId: null };
const driver: ActorState = { role: 'driver', driverId: 'drv-1' };
const driverWithoutId: ActorState = { role: 'driver', driverId: null };
const stranger: ActorState = { role: null, driverId: null };

describe('actorOwnsTrip', () => {
  it('офис владеет любым рейсом, даже если строка не видна', () => {
    expect(actorOwnsTrip(office, false)).toBe(true);
    expect(actorOwnsTrip(office, true)).toBe(true);
  });

  it('водитель владеет рейсом, который ему виден', () => {
    expect(actorOwnsTrip(driver, true)).toBe(true);
  });

  it('водитель не владеет рейсом, который ему не виден', () => {
    expect(actorOwnsTrip(driver, false)).toBe(false);
  });

  it('водитель без driver_id не владеет ничем', () => {
    expect(actorOwnsTrip(driverWithoutId, true)).toBe(false);
  });

  it('неизвестная роль не владеет рейсом', () => {
    expect(actorOwnsTrip(stranger, true)).toBe(false);
  });
});

describe('evaluateTripAccess', () => {
  it('офис получает доступ к любому рейсу', () => {
    expect(evaluateTripAccess(office, false)).toEqual({ ok: true });
    expect(evaluateTripAccess(office, true)).toEqual({ ok: true });
  });

  it('водитель получает доступ к своему рейсу', () => {
    expect(evaluateTripAccess(driver, true)).toEqual({ ok: true });
  });

  it('водитель не получает доступ к чужому рейсу', () => {
    const result = evaluateTripAccess(driver, false);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('Рейс не принадлежит вам');
  });

  it('водитель без driver_id получает отказ', () => {
    const result = evaluateTripAccess(driverWithoutId, true);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('Нет доступа');
  });

  it('роль без прав получает отказ', () => {
    const result = evaluateTripAccess(stranger, true);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('Нет доступа');
  });
});

describe('evaluateExpenseAccess', () => {
  it('офис получает доступ к любому расходу', () => {
    expect(evaluateExpenseAccess(office, false)).toEqual({ ok: true });
  });

  it('водитель получает доступ к своему расходу', () => {
    expect(evaluateExpenseAccess(driver, true)).toEqual({ ok: true });
  });

  it('водитель не получает доступ к чужому расходу', () => {
    const result = evaluateExpenseAccess(driver, false);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('Расход не принадлежит вам');
  });

  it('водитель без driver_id получает отказ', () => {
    const result = evaluateExpenseAccess(driverWithoutId, true);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBe('Нет доступа');
  });
});

describe('менеджер: видимость решает база', () => {
  const manager = { role: 'manager', driverId: null, managerId: 'm-1' } as ActorState;
  const managerNoCard = { role: 'manager', driverId: null, managerId: null } as ActorState;
  it('заказ/расход в периметре — можно, вне — нельзя', () => {
    expect(evaluateTripAccess(manager, true).ok).toBe(true);
    expect(evaluateTripAccess(manager, false).ok).toBe(false);
    expect(evaluateExpenseAccess(manager, true).ok).toBe(true);
    expect(evaluateExpenseAccess(manager, false).ok).toBe(false);
  });
  it('менеджер без карточки не получает полный доступ', () => {
    expect(evaluateTripAccess(managerNoCard, false).ok).toBe(false);
    expect(evaluateExpenseAccess(managerNoCard, false).ok).toBe(false);
  });
});

describe('закрытый рейс водителю только для чтения', () => {
  const driver = { role: 'driver', driverId: 'd-1', managerId: null } as ActorState;
  const office = { role: 'office', driverId: null, managerId: null } as ActorState;
  it('выставлен / оплачен — нельзя; в пути и завершён — можно', () => {
    expect(evaluateTripAccess(driver, true, 'invoiced').ok).toBe(false);
    expect(evaluateTripAccess(driver, true, 'paid').ok).toBe(false);
    expect(evaluateTripAccess(driver, true, 'active').ok).toBe(true);
    expect(evaluateTripAccess(driver, true, 'completed').ok).toBe(true);
    expect(evaluateExpenseAccess(driver, true, 'paid').ok).toBe(false);
    expect(evaluateExpenseAccess(driver, true, 'completed').ok).toBe(true);
  });
  it('офис правит и закрытый', () => {
    expect(evaluateTripAccess(office, true, 'paid').ok).toBe(true);
  });
});
