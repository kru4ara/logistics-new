import 'server-only';
import type { createClient } from '../supabase/admin';
import { fetchAll } from '../fetch-all';
import type { PurchaseRef, TripRef } from './match-rules';

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
    currency: r.currency,
    issueDate: r.issue_date ? String(r.issue_date).slice(0, 10) : null,
  }));
}

/** Заказы со счётом клиенту (выставлен / оплачен) — для прихода от клиента. */
export async function loadTripRefs(supabase: Supabase): Promise<TripRef[]> {
  const COLS = 'id, trip_number, client_request_number, invoice_number, status, revenue_eur, clients(name)';
  const full = await fetchAll(
    supabase.from('trips').select(`${COLS}, invoice_amount, invoice_currency`).in('status', ['invoiced', 'paid']).order('id'),
  );
  const res = full.error ? await fetchAll(supabase.from('trips').select(COLS).in('status', ['invoiced', 'paid']).order('id')) : full;
  return ((res.data ?? []) as any[]).map((r) => {
    const client = Array.isArray(r.clients) ? r.clients[0] : r.clients;
    const hasInvoice = r.invoice_amount != null;
    return {
      id: r.id,
      tripNumber: r.trip_number != null ? String(r.trip_number) : null,
      requestNumber: r.client_request_number != null ? String(r.client_request_number) : null,
      invoiceNumber: r.invoice_number,
      amount: hasInvoice ? Number(r.invoice_amount) : r.revenue_eur != null ? Number(r.revenue_eur) : null,
      currency: hasInvoice ? r.invoice_currency || 'EUR' : 'EUR',
      clientName: client?.name ?? null,
      paid: r.status === 'paid',
    };
  });
}
