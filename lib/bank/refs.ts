import 'server-only';
import type { createClient } from '../supabase/admin';
import { fetchAll } from '../fetch-all';
import type { PurchaseRef, TripRef } from './match-rules';
import { isoCurrency } from '../currency';
import type { AppliedCorrection } from '../invoicing/sync-rules';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Счета подрядчиков для сопоставления с платежами (все: оплаченные одним днём — тоже). */
export async function loadPurchaseRefs(supabase: Supabase): Promise<PurchaseRef[]> {
  const { data } = await fetchAll(
    supabase.from('purchase_invoices').select('id, invoice_number, seller_name, gross_amount, net_amount, currency, issue_date').order('id'),
  );
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    number: r.invoice_number,
    sellerName: r.seller_name,
    gross: r.gross_amount != null ? Number(r.gross_amount) : r.net_amount != null ? Number(r.net_amount) : null,
    currency: isoCurrency(r.currency, 'PLN'),
    issueDate: r.issue_date ? String(r.issue_date).slice(0, 10) : null,
  }));
}

/** Применённые корректы фактур (lib/invoicing/sync.ts, ключ invoicing.corrections). */
async function readCorrections(supabase: Supabase): Promise<AppliedCorrection[]> {
  const { data } = await supabase.from('integration_state').select('value').eq('key', 'invoicing.corrections').maybeSingle();
  try {
    const v = data?.value ? JSON.parse(data.value) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Сколько уже распределено на каждый заказ из приходов. */
export async function loadAllocatedByTrip(supabase: Supabase): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  const { data, error } = await fetchAll(supabase.from('payment_allocations').select('trip_id, amount').order('id'));
  if (error) return m;
  for (const r of (data ?? []) as { trip_id: string; amount: number }[]) m.set(r.trip_id, (m.get(r.trip_id) ?? 0) + Number(r.amount));
  return m;
}

/**
 * Заказы для приходов от клиентов: со счётом (выставлен / оплачен) и без счёта — в работе
 * и выполненные (на них приходит аванс). Сумма к оплате — брутто фактуры, без фактуры —
 * фрахт заказа в EUR; allocated — уже распределено из приходов.
 */
export async function loadTripRefs(supabase: Supabase): Promise<TripRef[]> {
  const COLS = 'id, trip_number, client_request_number, invoice_number, status, revenue_eur, clients(name)';
  const STATUSES = ['active', 'completed', 'invoiced', 'paid'];
  const full = await fetchAll(
    supabase.from('trips').select(`${COLS}, invoice_amount, invoice_currency`).in('status', STATUSES).order('id'),
  );
  const res = full.error ? await fetchAll(supabase.from('trips').select(COLS).in('status', STATUSES).order('id')) : full;
  const allocated = await loadAllocatedByTrip(supabase);
  const corrections = new Map<string, string[]>();
  for (const c of await readCorrections(supabase)) {
    if (c.number) corrections.set(c.tripId, [...(corrections.get(c.tripId) ?? []), c.number]);
  }
  return ((res.data ?? []) as any[]).map((r) => {
    const client = Array.isArray(r.clients) ? r.clients[0] : r.clients;
    const hasInvoice = r.invoice_amount != null;
    return {
      id: r.id,
      tripNumber: r.trip_number != null ? String(r.trip_number) : null,
      requestNumber: r.client_request_number != null ? String(r.client_request_number) : null,
      invoiceNumber: r.invoice_number,
      extraInvoiceNumbers: corrections.get(r.id) ?? [],
      amount: hasInvoice ? Number(r.invoice_amount) : r.revenue_eur != null ? Number(r.revenue_eur) : null,
      currency: hasInvoice ? isoCurrency(r.invoice_currency) : 'EUR',
      clientName: client?.name ?? null,
      paid: r.status === 'paid',
      invoiced: r.status === 'invoiced' || r.status === 'paid',
      allocated: allocated.get(r.id) ?? 0,
      revenueEur: r.revenue_eur != null ? Number(r.revenue_eur) : null,
    };
  });
}
