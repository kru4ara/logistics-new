import { describe, it, expect } from 'vitest';
import { inspectAgencyExpenses, agencySummary, type AgencyExpense } from '../payables/agency-check';

const e = (id: string, trip: string, category: string, o: Partial<AgencyExpense> = {}): AgencyExpense => ({
  id, trip_id: trip, category, description: null, original_amount: 10, currency: 'EUR', amount_eur: 10, purchase_invoice_id: null, paid_by_driver: false, ...o,
});

describe('проверка EPI / EX-1 по рейсам', () => {
  it('ручная + из счёта — возможный дубль; EPI и EX-1 — отдельно', () => {
    const rows = inspectAgencyExpenses([
      e('m', '6741', 'epi', { amount_eur: 35 }),
      e('i', '6741', 'ex1', { purchase_invoice_id: 'aw', amount_eur: 60 }),
      e('m2', '6551', 'epi', { amount_eur: 64.22 }),
      e('i2', '6551', 'epi', { purchase_invoice_id: 't', amount_eur: 62.72 }),
    ]);
    const by = (t: string, c: string) => rows.find((r) => r.tripId === t && r.category === c)!;
    expect(by('6551', 'epi').issue).toBe('double');
    expect(by('6741', 'epi').issue).toBe('noInvoice'); // EPI внесён руками, счёта нет
    expect(by('6741', 'ex1').issue).toBe('ok');
    expect(rows[0].issue).toBe('double');
  });

  it('оплатил водитель — не «без счёта»; два счёта одной категории — проверить', () => {
    const rows = inspectAgencyExpenses([
      e('d', '1', 'epi', { paid_by_driver: true }),
      e('a', '2', 'ex1', { purchase_invoice_id: 'x' }),
      e('b', '2', 'ex1', { purchase_invoice_id: 'y' }),
      e('c', '3', 'fuel'),
    ]);
    expect(rows.map((r) => [r.tripId, r.issue])).toEqual([['2', 'multi'], ['1', 'ok']]);
    expect(agencySummary(rows)).toEqual({ double: 0, noInvoice: 0, multi: 1, ok: 1 });
  });

  it('ручная, отмеченная «не дубль», больше не проблема', () => {
    const rows = inspectAgencyExpenses([e('m', '1', 'epi'), e('i', '1', 'epi', { purchase_invoice_id: 'x' }), e('n', '2', 'ex1')], new Set(['m', 'n']));
    expect(rows.map((r) => r.issue)).toEqual(['ok', 'ok']);
  });
});
