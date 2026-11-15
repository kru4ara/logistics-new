/**
 * Дебиторка: кто сколько должен и насколько просрочил.
 * Чистая логика без Supabase — покрыта тестом (lib/__tests__/receivables.test.ts).
 * Даты — строки 'YYYY-MM-DD'; «сегодня» передаётся снаружи.
 */

export const DEFAULT_PAYMENT_DAYS = 30;

export type ReceivableTrip = {
  id: string;
  trip_number: string | null;
  invoice_number: string | null;
  client_id: string | null;
  revenue_eur: number | string | null;
  /** брутто фактуры из сервиса фактур — если известно, долг считается по нему */
  invoice_amount?: number | string | null;
  invoice_currency?: string | null;
  invoiced_at: string | null;
  payment_due: string | null;
  end_date: string | null;
};

export type Bucket = 'current' | 'soon' | 'overdue' | 'overdue30' | 'overdue60';

export type Receivable = ReceivableTrip & {
  amount: number;
  /** фактура ≠ фрахт заказа: разница (фактура − фрахт), иначе null */
  amountDiff: number | null;
  due: string | null;
  /** срок посчитан приблизительно: у счёта нет даты, взята дата окончания рейса */
  estimated: boolean;
  /** > 0 — дней просрочки, ≤ 0 — дней до срока; null — срок неизвестен */
  daysOverdue: number | null;
  bucket: Bucket | null;
};

const DAY = 86_400_000;
const toUtc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
export const addDays = (d: string, n: number) => new Date(toUtc(d) + n * DAY).toISOString().slice(0, 10);
export const diffDays = (a: string, b: string) => Math.round((toUtc(a) - toUtc(b)) / DAY);

export function bucketOf(daysOverdue: number): Bucket {
  if (daysOverdue > 60) return 'overdue60';
  if (daysOverdue > 30) return 'overdue30';
  if (daysOverdue > 0) return 'overdue';
  if (daysOverdue >= -7) return 'soon';
  return 'current';
}

export function toReceivable(t: ReceivableTrip, clientDays: number | null | undefined, today: string): Receivable {
  const revenue = Number(t.revenue_eur) || 0;
  const inv = t.invoice_amount != null && t.invoice_amount !== '' ? Number(t.invoice_amount) : null;
  const invInEur = inv != null && Number.isFinite(inv) && (!t.invoice_currency || t.invoice_currency.toUpperCase() === 'EUR');
  const amount = invInEur ? (inv as number) : revenue;
  const amountDiff = invInEur && Math.abs((inv as number) - revenue) >= 0.5 ? Math.round(((inv as number) - revenue) * 100) / 100 : null;
  let due = t.payment_due;
  let estimated = false;
  if (!due) {
    const base = t.invoiced_at || (t.end_date ? t.end_date.slice(0, 10) : null);
    if (base) {
      due = addDays(base, clientDays ?? DEFAULT_PAYMENT_DAYS);
      estimated = true;
    }
  }
  const daysOverdue = due ? diffDays(today, due) : null;
  return { ...t, amount, amountDiff, due, estimated, daysOverdue, bucket: daysOverdue === null ? null : bucketOf(daysOverdue) };
}

export type ClientDebt = {
  clientId: string | null;
  total: number;
  overdue: number;
  maxDaysOverdue: number | null;
  items: Receivable[];
};

export type ReceivablesSummary = {
  total: number;
  overdue: number;
  overdueCount: number;
  soon: number;
  count: number;
  byBucket: Record<Bucket, number>;
  clients: ClientDebt[];
};

/** Сводка и группировка по клиентам: сначала те, кто дольше всех тянет с оплатой. */
export function summarize(items: Receivable[]): ReceivablesSummary {
  const byBucket: Record<Bucket, number> = { current: 0, soon: 0, overdue: 0, overdue30: 0, overdue60: 0 };
  const groups = new Map<string, ClientDebt>();
  let total = 0, overdue = 0, overdueCount = 0, soon = 0;
  for (const r of items) {
    total += r.amount;
    if (r.bucket) byBucket[r.bucket] += r.amount;
    const isOverdue = (r.daysOverdue ?? 0) > 0;
    if (isOverdue) { overdue += r.amount; overdueCount++; }
    if (r.bucket === 'soon') soon += r.amount;
    const key = r.client_id ?? '';
    const g = groups.get(key) ?? { clientId: r.client_id, total: 0, overdue: 0, maxDaysOverdue: null, items: [] };
    g.total += r.amount;
    if (isOverdue) g.overdue += r.amount;
    if (r.daysOverdue !== null) g.maxDaysOverdue = Math.max(g.maxDaysOverdue ?? -Infinity, r.daysOverdue);
    g.items.push(r);
    groups.set(key, g);
  }
  const clients = [...groups.values()];
  for (const g of clients) g.items.sort((a, b) => (b.daysOverdue ?? -1e9) - (a.daysOverdue ?? -1e9));
  clients.sort((a, b) => (b.maxDaysOverdue ?? -1e9) - (a.maxDaysOverdue ?? -1e9) || b.total - a.total);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { total: r2(total), overdue: r2(overdue), overdueCount, soon: r2(soon), count: items.length, byBucket, clients };
}
