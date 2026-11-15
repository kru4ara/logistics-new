import 'server-only';
import type { createClient } from './supabase/admin';
import { fetchAll } from './fetch-all';
import type { ReceivableTrip } from './receivables';

type Supabase = Awaited<ReturnType<typeof createClient>>;

const COLS = 'id, trip_number, invoice_number, client_id, revenue_eur, invoiced_at, payment_due, end_date';

/**
 * Заказы «Счёт выставлен» для дебиторки. Сумма фактуры (миграция 030) — если колонки
 * уже есть; до миграции — без неё, чтобы дебиторка и «Сегодня» не падали.
 */
export async function loadInvoicedTrips(supabase: Supabase): Promise<{ data: ReceivableTrip[] | null; error: { message: string } | null }> {
  const full = await fetchAll(supabase.from('trips').select(`${COLS}, invoice_amount, invoice_currency`).eq('status', 'invoiced'));
  if (!full.error) return { data: (full.data ?? []) as ReceivableTrip[], error: null };
  if (!/invoice_amount|invoice_currency/.test(full.error.message)) return { data: null, error: full.error };
  const old = await fetchAll(supabase.from('trips').select(COLS).eq('status', 'invoiced'));
  return { data: (old.data ?? null) as ReceivableTrip[] | null, error: old.error };
}
