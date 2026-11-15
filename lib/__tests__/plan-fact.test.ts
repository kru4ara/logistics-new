import { describe, it, expect } from 'vitest';
import { eurAt, monthRange, buildPlanFact, type SegmentPF, type ClientPF } from '../plan-fact';

const seg = (o: Partial<SegmentPF>): SegmentPF => ({
  segmentId: 's', tripId: 't', tripNumber: '1', position: 1, contractorId: 'c1', contractorName: 'A',
  planEur: 1000, factEur: null, invoiceCount: 0, ...o,
});

describe('план → факт', () => {
  it('курс на дату и месяц', () => {
    const rates = [
      { rate_date: '2026-09-01', pln_to_eur: 0.23, byn_to_eur: 0.3 },
      { rate_date: '2026-09-15', pln_to_eur: 0.24, byn_to_eur: null },
    ];
    expect(eurAt(1000, 'PLN', '2026-09-10', rates)).toBe(230);
    expect(eurAt(1000, 'PLN', '2026-09-20', rates)).toBe(240);
    expect(eurAt(1000, 'BYN', '2026-09-20', rates)).toBe(300);
    expect(eurAt(1000, 'EUR', '2026-09-20', rates)).toBe(1000);
    expect(monthRange('2026-12', '2026-11-15')).toEqual({ month: '2026-12', from: '2026-12-01', to: '2027-01-01' });
    expect(monthRange('x', '2026-11-15')).toEqual({ month: '2026-11', from: '2026-11-01', to: '2026-12-01' });
  });

  it('расхождения, подрядчики, участки без счёта, клиенты, влияние на маржу', () => {
    const segments = [
      seg({ segmentId: 'a', contractorId: 'c1', contractorName: 'WM', planEur: 2400, factEur: 2600, invoiceCount: 2 }), // +200
      seg({ segmentId: 'b', contractorId: 'c1', contractorName: 'WM', planEur: 1000, factEur: 1000, invoiceCount: 1 }),
      seg({ segmentId: 'c', contractorId: 'c2', contractorName: 'Kamex', planEur: 3500, factEur: 3450, invoiceCount: 1 }), // −50
      seg({ segmentId: 'd', contractorId: 'c2', contractorName: 'Kamex', planEur: 900, factEur: null, invoiceCount: 0 }), // нет счёта
      seg({ segmentId: 'e', contractorId: 'c3', contractorName: 'X', planEur: 1000, factEur: 1005, invoiceCount: 1 }), // в допуске
    ];
    const clients: ClientPF[] = [
      { tripId: 't30', tripNumber: '30Е', clientName: 'MSB', invoiceNumber: '74/10/2026', revenueEur: 3900, invoiceEur: 4100 },
      { tripId: 't1', tripNumber: '1', clientName: 'MSB', invoiceNumber: '1', revenueEur: 1000, invoiceEur: 1000 },
      { tripId: 't2', tripNumber: '2', clientName: 'MSB', invoiceNumber: null, revenueEur: 1000, invoiceEur: null },
    ];
    const r = buildPlanFact(segments, clients);
    expect(r.segDiffs.map((s) => [s.segmentId, s.diffEur])).toEqual([['a', 200], ['c', -50]]);
    expect(r.missing.map((s) => s.segmentId)).toEqual(['d']);
    expect(r.contractors[0]).toMatchObject({ name: 'WM', segments: 2, invoiced: 2, planEur: 3400, factEur: 3600, diffEur: 200, over: 1 });
    expect(r.contractors.find((c) => c.name === 'Kamex')).toMatchObject({ segments: 2, invoiced: 1, diffEur: -50, over: 0 });
    expect(r.clientDiffs.map((c) => [c.tripNumber, c.diffEur])).toEqual([['30Е', 200]]);
    expect(r.totals).toEqual({ segments: 5, invoiced: 4, planEur: 7900, factEur: 8055, contractorDiff: 155, clientDiff: 200, marginImpact: 45 });
  });
});
