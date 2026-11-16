import { describe, it, expect } from 'vitest';
import { parseStaffForm, staffChangeBlock, isStaffProfile } from '../staff-rules';

describe('сотрудники офиса', () => {
  it('форма: имя, e-mail, пароль от 8 символов, роль office|accountant', () => {
    expect(parseStaffForm({ full_name: 'Anna', email: ' Anna@Firma.PL ', password: '12345678', role: 'accountant' })).toEqual({
      ok: true, email: 'anna@firma.pl', password: '12345678', role: 'accountant', fullName: 'Anna',
    });
    expect(parseStaffForm({ full_name: '', email: 'a@b.pl', password: '12345678', role: 'office' })).toEqual({ ok: false, error: 'name' });
    expect(parseStaffForm({ full_name: 'A', email: 'a@b', password: '12345678', role: 'office' })).toEqual({ ok: false, error: 'email' });
    expect(parseStaffForm({ full_name: 'A', email: 'a@b.pl', password: '1234567', role: 'office' })).toEqual({ ok: false, error: 'password' });
    expect(parseStaffForm({ full_name: 'A', email: 'a@b.pl', password: '12345678', role: 'driver' })).toEqual({ ok: false, error: 'role' });
  });

  it('себя и последнего офиса не трогаем', () => {
    const base = { actorId: 'me', targetId: 'x', targetRole: 'office', newRole: 'accountant' as const, officeCount: 2 };
    expect(staffChangeBlock({ ...base, targetId: 'me' })).toBe('self');
    expect(staffChangeBlock({ ...base, officeCount: 1 })).toBe('lastOffice');
    expect(staffChangeBlock({ ...base, targetRole: 'admin', newRole: null, officeCount: 1 })).toBe('lastOffice');
    expect(staffChangeBlock(base)).toBeNull();
    expect(staffChangeBlock({ ...base, targetRole: 'accountant', newRole: null, officeCount: 1 })).toBeNull();
  });

  it('кто сотрудник офиса', () => {
    expect(isStaffProfile('admin')).toBe(true);
    expect(isStaffProfile('accountant')).toBe(true);
    expect(isStaffProfile('manager')).toBe(false);
    expect(isStaffProfile('driver')).toBe(false);
  });
});
