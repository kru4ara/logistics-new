import { describe, it, expect } from 'vitest';
import { invoiceKey, findDuplicateGroups, planManualMerge, isValidPaidDate } from '../payables/duplicate-rules';

const r = (id: string, o: Partial<{ source: 'ksef' | 'manual'; seller_nip: string | null; invoice_number: string | null; segment_id: string | null }> = {}) => ({
  id, source: 'ksef' as const, seller_nip: '5070098863', invoice_number: 'FV/397/09/2026', segment_id: null, ...o,
});

describe('дубли счетов подрядчика', () => {
  it('ключ не зависит от префикса страны, пробелов и регистра', () => {
    expect(invoiceKey('PL5070098863', 'FV/397/09/2026')).toBe(invoiceKey('5070098863', ' fv/397/09/2026 '));
    expect(invoiceKey(null, 'FV/1')).toBeNull();
    expect(invoiceKey('123', '')).toBeNull();
  });

  it('находит пару «ручной + KSeF» (случай Stef-Trans)', () => {
    const g = findDuplicateGroups([
      r('ksef', { segment_id: 'seg-6750-2' }),
      r('man', { source: 'manual', seller_nip: 'PL5070098863', segment_id: 'seg-6788-1' }),
      r('other', { invoice_number: 'FV/28/11/2026' }),
    ]);
    expect(g.map((x) => x.map((y) => y.id))).toEqual([['ksef', 'man']]);
  });

  it('сливает автоматически, только когда однозначно', () => {
    // KSeF без привязки — забирает привязку ручного
    expect(planManualMerge([r('k'), r('m', { source: 'manual', segment_id: 's1' })])?.drop.id).toBe('m');
    // тот же участок — тоже можно
    expect(planManualMerge([r('k', { segment_id: 's1' }), r('m', { source: 'manual', segment_id: 's1' })])?.keep.id).toBe('k');
    // разные участки — решает человек
    expect(planManualMerge([r('k', { segment_id: 's2' }), r('m', { source: 'manual', segment_id: 's1' })])).toBeNull();
    // два ручных или три строки — не трогаем
    expect(planManualMerge([r('a', { source: 'manual' }), r('b', { source: 'manual' })])).toBeNull();
    expect(planManualMerge([r('a'), r('b', { source: 'manual' }), r('c', { source: 'manual' })])).toBeNull();
  });
});

describe('дата оплаты', () => {
  it('прошлая или сегодня — да; будущее и мусор — нет', () => {
    expect(isValidPaidDate('2026-10-20', '2026-11-17')).toBe(true);
    expect(isValidPaidDate('2026-11-17', '2026-11-17')).toBe(true);
    expect(isValidPaidDate('2026-11-18', '2026-11-17')).toBe(false);
    expect(isValidPaidDate('2026-02-30', '2026-11-17')).toBe(false);
    expect(isValidPaidDate('17.11.2026', '2026-11-17')).toBe(false);
    expect(isValidPaidDate('1999-12-31', '2026-11-17')).toBe(false);
  });
});
