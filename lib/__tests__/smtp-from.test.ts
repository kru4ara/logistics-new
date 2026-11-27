import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { emailOf, fromAddress } from '../mail/smtp';

describe('SMTP «от кого»', () => {
  it('адрес из строки', () => {
    expect(emailOf('Raibuilding <biuro@firma.pl>')).toBe('biuro@firma.pl');
    expect(emailOf('biuro@firma.pl')).toBe('biuro@firma.pl');
    expect(emailOf('"Raibuilding Sp. z O.O."')).toBeNull();
  });
  it('только название → адрес из SMTP_USER', () => {
    expect(fromAddress('"Raibuilding Sp. z O.O."', 'biuro@firma.pl')).toBe('"Raibuilding Sp. z O.O." <biuro@firma.pl>');
    expect(fromAddress('Raibuilding', 'biuro@firma.pl')).toBe('"Raibuilding" <biuro@firma.pl>');
  });
  it('полный SMTP_FROM — как есть; пустой — SMTP_USER', () => {
    expect(fromAddress('Raibuilding <biuro@firma.pl>', 'x@y.pl')).toBe('Raibuilding <biuro@firma.pl>');
    expect(fromAddress('', 'biuro@firma.pl')).toBe('biuro@firma.pl');
  });
});
