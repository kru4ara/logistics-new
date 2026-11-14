import { describe, it, expect } from 'vitest';
import { toReceivable, summarize, bucketOf, addDays, diffDays } from '../receivables';

const base = { trip_number: '1', invoice_number: null, revenue_eur: 1000, invoiced_at: null, payment_due: null, end_date: null };
const today = '2026-11-15';

describe('дебиторка', () => {
  it('даты', () => {
    expect(addDays('2026-11-15', 30)).toBe('2026-12-15');
    expect(diffDays('2026-11-15', '2026-11-01')).toBe(14);
  });

  it('срок из счёта, иначе приблизительно от даты окончания рейса', () => {
    const exact = toReceivable({ ...base, id: 'a', client_id: 'c', payment_due: '2026-11-10' }, 14, today);
    expect(exact).toMatchObject({ due: '2026-11-10', estimated: false, daysOverdue: 5, bucket: 'overdue' });
    const est = toReceivable({ ...base, id: 'b', client_id: 'c', end_date: '2026-10-01T00:00:00' }, 14, today);
    expect(est).toMatchObject({ due: '2026-10-15', estimated: true, daysOverdue: 31, bucket: 'overdue30' });
    const unknown = toReceivable({ ...base, id: 'x', client_id: null }, null, today);
    expect(unknown).toMatchObject({ due: null, daysOverdue: null, bucket: null });
  });

  it('корзины по сроку', () => {
    expect([-30, -7, 0, 1, 31, 61].map(bucketOf)).toEqual(['current', 'soon', 'soon', 'overdue', 'overdue30', 'overdue60']);
  });

  it('сводка: итоги и клиенты по давности долга', () => {
    const items = [
      toReceivable({ ...base, id: '1', client_id: 'late', revenue_eur: '500', payment_due: '2026-09-01' }, null, today),
      toReceivable({ ...base, id: '2', client_id: 'ok', revenue_eur: 2000, payment_due: '2026-11-20' }, null, today),
      toReceivable({ ...base, id: '3', client_id: 'late', revenue_eur: 300.5, payment_due: '2026-12-31' }, null, today),
    ];
    const s = summarize(items);
    expect(s).toMatchObject({ total: 2800.5, overdue: 500, overdueCount: 1, soon: 2000, count: 3 });
    expect(s.clients.map((c) => c.clientId)).toEqual(['late', 'ok']);
    expect(s.clients[0]).toMatchObject({ total: 800.5, overdue: 500, maxDaysOverdue: 75 });
    expect(s.clients[0].items.map((i) => i.id)).toEqual(['1', '3']);
  });
});
