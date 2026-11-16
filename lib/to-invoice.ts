/**
 * «К выставлению»: заказы без счёта, по которым есть CMR (можно выставлять),
 * и завершённые без CMR (ждём документы). CMR — документ рейса `trip_documents`
 * с типом 'cmr': его грузит водитель из кабинета или офис на странице заказа.
 * Чистая логика — тест lib/__tests__/to-invoice.test.ts.
 */
import { diffDays } from './receivables';

/** Счёт ещё не выставлен — эти статусы (выставление переводит в 'invoiced'). */
export const NOT_INVOICED_STATUSES = ['active', 'completed'] as const;

export type ToInvoiceTrip = {
  id: string;
  trip_number: string | null;
  client_id: string | null;
  status: string | null;
  end_date: string | null;
  revenue_eur: number | null;
};

export type ToInvoiceRow = ToInvoiceTrip & {
  /** когда загружен первый CMR; null — нет */
  cmrAt: string | null;
  cmrCount: number;
  /** дней ждёт счёта: от CMR (или от окончания рейса без CMR) */
  waitingDays: number | null;
};

export type ToInvoiceList = { ready: ToInvoiceRow[]; noCmr: ToInvoiceRow[]; readyTotal: number };

export function firstCmrByTrip(docs: { trip_id: string | null; uploaded_at: string | null }[]): Map<string, { at: string; count: number }> {
  const m = new Map<string, { at: string; count: number }>();
  for (const d of docs) {
    if (!d.trip_id || !d.uploaded_at) continue;
    const cur = m.get(d.trip_id);
    if (!cur) m.set(d.trip_id, { at: d.uploaded_at, count: 1 });
    else m.set(d.trip_id, { at: d.uploaded_at < cur.at ? d.uploaded_at : cur.at, count: cur.count + 1 });
  }
  return m;
}

export function buildToInvoice(
  trips: ToInvoiceTrip[],
  cmr: Map<string, { at: string; count: number }>,
  today: string,
): ToInvoiceList {
  const ready: ToInvoiceRow[] = [];
  const noCmr: ToInvoiceRow[] = [];
  for (const tr of trips) {
    if (!(NOT_INVOICED_STATUSES as readonly string[]).includes(tr.status ?? '')) continue;
    const c = cmr.get(tr.id);
    if (c) {
      ready.push({ ...tr, cmrAt: c.at, cmrCount: c.count, waitingDays: Math.max(0, diffDays(today, c.at.slice(0, 10))) });
    } else if (tr.status === 'completed') {
      const end = tr.end_date?.slice(0, 10) ?? null;
      noCmr.push({ ...tr, cmrAt: null, cmrCount: 0, waitingDays: end ? Math.max(0, diffDays(today, end)) : null });
    }
  }
  const byWait = (a: ToInvoiceRow, b: ToInvoiceRow) => (b.waitingDays ?? -1) - (a.waitingDays ?? -1);
  ready.sort(byWait);
  noCmr.sort(byWait);
  const readyTotal = Math.round(ready.reduce((s, r) => s + (Number(r.revenue_eur) || 0), 0) * 100) / 100;
  return { ready, noCmr, readyTotal };
}

/**
 * Водитель не завершает рейс без CMR: иначе заказ «завершён», а выставить счёт
 * не по чему. Офис может (CMR придёт позже — заказ попадёт в «нет CMR»).
 */
export function completionBlock(p: { status: string; isDriver: boolean; cmrCount: number }): 'needCmr' | null {
  return p.status === 'completed' && p.isDriver && p.cmrCount === 0 ? 'needCmr' : null;
}
