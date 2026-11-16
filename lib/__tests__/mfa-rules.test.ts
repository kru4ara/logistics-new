import { describe, it, expect } from 'vitest';
import { needsMfaCode, needsMfaSetup, parseTotpCode } from '../mfa-rules';

describe('2FA', () => {
  it('код нужен, когда фактор есть, а вход пока паролем', () => {
    expect(needsMfaCode('aal1', 'aal2')).toBe(true);
    expect(needsMfaCode('aal2', 'aal2')).toBe(false);
    expect(needsMfaCode('aal1', 'aal1')).toBe(false);
    expect(needsMfaCode(null, null)).toBe(false);
  });
  it('подключить — только сотруднику офиса без фактора, если компания требует', () => {
    expect(needsMfaSetup({ required: true, isStaff: true, hasFactor: false })).toBe(true);
    expect(needsMfaSetup({ required: true, isStaff: true, hasFactor: true })).toBe(false);
    expect(needsMfaSetup({ required: true, isStaff: false, hasFactor: false })).toBe(false);
    expect(needsMfaSetup({ required: false, isStaff: true, hasFactor: false })).toBe(false);
  });
  it('код: 6 цифр', () => {
    expect(parseTotpCode(' 123 456 ')).toBe('123456');
    expect(parseTotpCode('12345')).toBeNull();
    expect(parseTotpCode('12a456')).toBeNull();
  });
});
