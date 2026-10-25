export type ClientRow = {
  name: string;
  type: 'Рейсы' | 'Экспедирование';
  count: number;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
};

export type TruckRow = {
  id: string;
  registration: string;
  count: number;
  km: number;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
};

export function pickName(rel: unknown): string {
  if (!rel) return '';
  if (Array.isArray(rel)) return rel[0]?.name || '';
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name || '';
  }
  return '';
}

export function pickTruck(rel: unknown): string {
  if (!rel) return '';
  if (Array.isArray(rel)) return rel[0]?.registration_number || '';
  if (typeof rel === 'object' && 'registration_number' in rel) {
    return (rel as { registration_number?: string }).registration_number || '';
  }
  return '';
}

export function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function calculateProfitability({
  trips,
  forwarding,
  expensesByTrip,
  contractorsByFwd,
  expensesByFwd,
}: {
  trips: any[] | null;
  forwarding: any[] | null;
  expensesByTrip: Record<string, number>;
  contractorsByFwd: Record<string, number>;
  expensesByFwd: Record<string, number>;
}): {
  clientRows: ClientRow[];
  truckRows: TruckRow[];
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  totalMargin: number;
} {
  const clientRows: ClientRow[] = [];
  const byClientTrips: Record<string, { name: string; count: number; revenue: number; expenses: number }> = {};

  for (const t of trips || []) {
    const name = pickName((t as any).clients);
    if (!name) continue;
    if (!byClientTrips[name]) byClientTrips[name] = { name, count: 0, revenue: 0, expenses: 0 };
    byClientTrips[name].count += 1;
    byClientTrips[name].revenue += toNum((t as any).revenue_eur);
    byClientTrips[name].expenses += expensesByTrip[(t as any).id] || 0;
  }

  for (const r of Object.values(byClientTrips)) {
    const profit = r.revenue - r.expenses;
    const margin = r.revenue > 0 ? (profit / r.revenue) * 100 : 0;
    clientRows.push({
      name: r.name,
      type: 'Рейсы',
      count: r.count,
      revenue: r.revenue,
      expenses: r.expenses,
      profit,
      margin,
    });
  }

  const byClientFwd: Record<string, { name: string; count: number; revenue: number; expenses: number }> = {};

  for (const f of forwarding || []) {
    const name = pickName((f as any).clients);
    if (!name) continue;
    if (!byClientFwd[name]) byClientFwd[name] = { name, count: 0, revenue: 0, expenses: 0 };
    byClientFwd[name].count += 1;
    byClientFwd[name].revenue += toNum((f as any).client_price_eur);
    byClientFwd[name].expenses +=
      (contractorsByFwd[(f as any).id] || 0) + (expensesByFwd[(f as any).id] || 0);
  }

  for (const r of Object.values(byClientFwd)) {
    const profit = r.revenue - r.expenses;
    const margin = r.revenue > 0 ? (profit / r.revenue) * 100 : 0;
    clientRows.push({
      name: r.name,
      type: 'Экспедирование',
      count: r.count,
      revenue: r.revenue,
      expenses: r.expenses,
      profit,
      margin,
    });
  }

  clientRows.sort((a, b) => b.profit - a.profit);

  const byTruck: Record<string, { id: string; registration: string; count: number; km: number; revenue: number; expenses: number }> = {};

  for (const t of trips || []) {
    const truckId = (t as any).truck_id;
    if (!truckId) continue;
    const registration = pickTruck((t as any).trucks) || '—';

    if (!byTruck[truckId]) {
      byTruck[truckId] = { id: truckId, registration, count: 0, km: 0, revenue: 0, expenses: 0 };
    }
    byTruck[truckId].count += 1;
    byTruck[truckId].km += toNum((t as any).actual_km);
    byTruck[truckId].revenue += toNum((t as any).revenue_eur);
    byTruck[truckId].expenses += expensesByTrip[(t as any).id] || 0;
  }

  const truckRows: TruckRow[] = Object.values(byTruck).map((t) => {
    const profit = t.revenue - t.expenses;
    const margin = t.revenue > 0 ? (profit / t.revenue) * 100 : 0;
    return { ...t, profit, margin };
  });
  truckRows.sort((a, b) => b.profit - a.profit);

  const totalRevenue = clientRows.reduce((s, r) => s + r.revenue, 0);
  const totalExpenses = clientRows.reduce((s, r) => s + r.expenses, 0);
  const totalProfit = totalRevenue - totalExpenses;
  const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return { clientRows, truckRows, totalRevenue, totalExpenses, totalProfit, totalMargin };
}
