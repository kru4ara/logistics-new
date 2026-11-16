import { describe, it, expect } from 'vitest';
import { buildDemoData } from '../demo/data';

const today = '2026-11-16';
const d = buildDemoData(today);
const ids = (rows: Record<string, unknown>[]) => new Set(rows.map((r) => r.id));

describe('демо-данные', () => {
  it('одинаковые от сброса к сбросу', () => {
    expect(buildDemoData(today)).toEqual(d);
  });

  it('связи целы', () => {
    const clients = ids(d.clients), drivers = ids(d.drivers), trucks = ids(d.trucks), trips = ids(d.trips);
    const managers = ids(d.managers), contractors = ids(d.contractors), segs = ids(d.segments);
    for (const t of d.trips) {
      expect(clients.has(t.client_id)).toBe(true);
      if (t.driver_id) expect(drivers.has(t.driver_id)).toBe(true);
      if (t.truck_id) expect(trucks.has(t.truck_id)).toBe(true);
      if (t.manager_id) expect(managers.has(t.manager_id)).toBe(true);
    }
    for (const s of d.segments) {
      expect(trips.has(s.trip_id)).toBe(true);
      if (s.contractor_id) expect(contractors.has(s.contractor_id)).toBe(true);
    }
    for (const e of d.expenses) {
      expect(trips.has(e.trip_id)).toBe(true);
      if (e.segment_id) expect(segs.has(e.segment_id)).toBe(true);
    }
    for (const doc of d.documents) expect(trips.has(doc.trip_id)).toBe(true);
    const all = [d.managers, d.clients, d.contractors, d.drivers, d.trucks, d.locations, d.trips, d.segments, d.cargo, d.expenses, d.documents, d.fixedCosts].flat();
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
  });

  it('есть что показать: все статусы, просрочка, «к выставлению», экспедиция', () => {
    const by = (s: string) => d.trips.filter((t) => t.status === s).length;
    for (const s of ['planned', 'active', 'completed', 'invoiced', 'paid']) expect(by(s), s).toBeGreaterThan(0);
    expect(d.trips.some((t) => t.status === 'invoiced' && String(t.payment_due) < today)).toBe(true);
    const cmrTrips = new Set(d.documents.map((x) => x.trip_id));
    expect(d.trips.some((t) => t.status === 'completed' && cmrTrips.has(t.id))).toBe(true);
    expect(d.trips.some((t) => t.status === 'completed' && !cmrTrips.has(t.id))).toBe(true);
    expect(d.trips.some((t) => t.profit_mode === 'forwarding')).toBe(true);
    expect(d.trips.some((t) => t.manager_id === null)).toBe(true);
  });

  it('у оплаченных дата оплаты не в будущем, у выставленных — номер и срок', () => {
    for (const t of d.trips) {
      if (t.status === 'paid') expect(String(t.paid_at) <= today).toBe(true);
      if (t.status === 'invoiced' || t.status === 'paid') {
        expect(t.invoice_number).toBeTruthy();
        expect(t.payment_due).toBeTruthy();
      }
    }
  });
});
