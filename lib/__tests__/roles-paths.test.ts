import { describe, it, expect } from 'vitest';
import {
  isOpenToAllRoles,
  canUseUnlistedPath,
  capabilityForRequest,
} from '../roles';

describe('пути без правила в PATH_CAPABILITIES', () => {
  it('открыты всем только из белого списка', () => {
    expect(isOpenToAllRoles('/')).toBe(true);
    expect(isOpenToAllRoles('/driver')).toBe(true);
    expect(isOpenToAllRoles('/driver/trips/1')).toBe(true);
    expect(isOpenToAllRoles('/login')).toBe(true);
    expect(isOpenToAllRoles('/manifest.webmanifest')).toBe(true);
  });

  it('/drivers (офисный справочник) не путается с /driver', () => {
    expect(isOpenToAllRoles('/drivers')).toBe(false);
    expect(isOpenToAllRoles('/drivers/123')).toBe(false);
  });

  it('прочие пути без правила не открыты всем', () => {
    expect(isOpenToAllRoles('/forwarding')).toBe(false);
    expect(isOpenToAllRoles('/logisat')).toBe(false);
    expect(isOpenToAllRoles('/api/unknown')).toBe(false);
  });

  it('водитель и неизвестная роль не проходят на неизвестные пути', () => {
    expect(canUseUnlistedPath('driver')).toBe(false);
    expect(canUseUnlistedPath(undefined)).toBe(false);
    expect(canUseUnlistedPath(null)).toBe(false);
    expect(canUseUnlistedPath('client')).toBe(false);
  });

  it('офис, менеджер и алиас admin проходят', () => {
    expect(canUseUnlistedPath('office')).toBe(true);
    expect(canUseUnlistedPath('admin')).toBe(true);
    expect(canUseUnlistedPath('manager')).toBe(true);
  });

  it('фиксируем: /forwarding пока без правила в PATH_CAPABILITIES', () => {
    // Если для /forwarding заведут capability — тест обновить.
    expect(capabilityForRequest('/forwarding', 'GET')).toBeNull();
  });
});
