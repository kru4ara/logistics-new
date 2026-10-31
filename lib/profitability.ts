import { getOrderUnloadDate } from './orders-core';
export type ClientRow = {
  name: string;
  type: 'Заказы' | 'Экспедирование';
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

/**
 * Дата заказа для фильтра по периоду — зависит от режима расчёта:
 *   trip       -> end_date || start_date (финиш)
 *   forwarding -> unload_date || load_date (разгрузка)
 */
export function getOrderPeriodDate(order: any): string | null {
  const raw = getOrderUnloadDate(order);
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Прибыльность по клиентам и по нашему транспорту.
 * Источник — единые заказы (trips), где экспедиции помечены profit_mode.
 */
export function calculateProfitability({
  orders,
  expensesByOrder,
  contractorByOrder,
}: {
  orders: any[] | null;
  expensesByOrder: Record<string, number>;
  contractorByOrder: Record<string, number>;
}): {
  clientRows: ClientRow[];
  truckRows: TruckRow[];
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  totalMargin: number;
} {
  const clientRows: ClientRow[] = [];

  type Bucket = { name: string; count: number; revenue: number; expenses: number };
  const byName: Record<string, { orders: Bucket; forwarding: Bucket }> = {};

  for (const o of orders || []) {
    const name = pickName((o as any).clients);
    if (!name) continue;

    const isFwd = o?.profit_mode === 'forwarding';
    const revenue = toNum((o as any).revenue_eur);
    const expenses =
      toNum(expensesByOrder[(o as any).id]) + toNum(contractorByOrder[(o as any).id]);

    if (!byName[name]) {
      byName[name] = {
        orders: { name, count: 0, revenue: 0, expenses: 0 },
        forwarding: { name, count: 0, revenue: 0, expenses: 0 },
      };
    }
    const bucket = isFwd ? byName[name].forwarding : byName[name].orders;
    bucket.count += 1;
    bucket.revenue += revenue;
    bucket.expenses += expenses;
  }

  for (const entry of Object.values(byName)) {
    const pairs = [
      [entry.orders, 'Заказы'] as const,
      [entry.forwarding, 'Экспедирование'] as const,
    ];
    for (const [bucket, type] of pairs) {
      if (bucket.count === 0) continue;
      const profit = bucket.revenue - bucket.expenses;
      const margin = bucket.revenue > 0 ? (profit / bucket.revenue) * 100 : 0;
      clientRows.push({
        name: bucket.name,
        type,
        count: bucket.count,
        revenue: bucket.revenue,
        expenses: bucket.expenses,
        profit,
        margin,
      });
    }
  }

  clientRows.sort((a, b) => b.profit - a.profit);

  const byTruck: Record<
    string,
    { id: string; registration: string; count: number; km: number; revenue: number; expenses: number }
  > = {};

  for (const o of orders || []) {
    if (o?.profit_mode === 'forwarding') continue;
    const truckId = (o as any).truck_id;
    if (!truckId) continue;
    const registration = pickTruck((o as any).trucks) || '—';

    if (!byTruck[truckId]) {
      byTruck[truckId] = {
        id: truckId,
        registration,
        count: 0,
        km: 0,
        revenue: 0,
        expenses: 0,
      };
    }
    byTruck[truckId].count += 1;
    byTruck[truckId].km += toNum((o as any).actual_km);
    byTruck[truckId].revenue += toNum((o as any).revenue_eur);
    byTruck[truckId].expenses += toNum(expensesByOrder[(o as any).id]);
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
