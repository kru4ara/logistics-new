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
