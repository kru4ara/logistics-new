import { describe, it, expect } from 'vitest';
import { formatEur, formatMoney, formatNumber } from '../i18n/format';

const s = (x: string) => x.replace(/[\u00a0\u202f]/g, ' ');

describe('formatMoney', () => {
  it('группы тысяч и знак', () => {
    expect(s(formatEur(331424))).toBe('331 424 €');
    expect(s(formatEur(7000))).toBe('7 000 €');
    expect(s(formatEur(1389.5, 2))).toBe('1 389,50 €');
    expect(s(formatEur(-315))).toBe('−315 €');
    expect(s(formatMoney(1389, 0, 'PLN'))).toBe('1 389 zł');
  });
  it('auto и пусто', () => {
    expect(s(formatEur(439.49, 'auto'))).toBe('439,49 €');
    expect(s(formatEur(440, 'auto'))).toBe('440 €');
    expect(formatEur(null)).toBe('—');
    expect(formatEur('abc')).toBe('—');
    expect(s(formatNumber('1200'))).toBe('1 200');
  });
});
