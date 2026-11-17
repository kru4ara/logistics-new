import 'server-only';
import type { createClient } from '../supabase/admin';
import { fetchAll, fetchAllByIds } from '../fetch-all';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AdvanceItem = {
  txId: string;
  date: string;
  counterparty: string | null;
  currency: string;
  amount: number;
  /** не легло ни на один заказ */
  unallocated: number;
  /** легло на заказы, по которым ещё нет счёта */
  onTrips: { tripId: string; label: string; amount: number }[];
};

export type Advances = {
  items: AdvanceItem[];
  /** приходы от клиентов без решения в «Банке» */
  pendingCount: number;
};

/**
 * Авансы и нераспределённые приходы клиентов: разнесённые приходы с остатком и доли на
 * заказы без счёта; плюс сколько приходов ещё не разобрано. До миграций 040/044 — пусто.
 */
export async function loadAdvances(supabase: Supabase): Promise<Advances> {
  const empty: Advances = { items: [], pendingCount: 0 };
  const { count: pendingCount, error: pErr } = await supabase
    .from('bank_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'new')
    .eq('kind', 'client');
  if (pErr) return empty;
  const { data: txs, error } = await fetchAll(
    supabase
      .from('bank_transactions')
      .select('id, booking_date, counterparty, currency, amount, trip_ids')
      .eq('status', 'matched')
      .gt('amount', 0)
      .order('booking_date', { ascending: false })
      .order('id'),
  );
  if (error) return { ...empty, pendingCount: pendingCount ?? 0 };
  const rows = ((txs ?? []) as any[]).filter((r) => (r.trip_ids ?? []).length);
  const { data: al, error: aErr } = await fetchAllByIds(
    rows.map((r) => r.id),
    (chunk) => supabase.from('payment_allocations').select('bank_transaction_id, trip_id, amount').in('bank_transaction_id', chunk),
  );
  if (aErr) return { ...empty, pendingCount: pendingCount ?? 0 };
  const allocs = (al ?? []) as { bank_transaction_id: string; trip_id: string; amount: number }[];
  const tripIds = [...new Set(allocs.map((a) => a.trip_id))];
  const { data: trips } = await fetchAllByIds(tripIds, (chunk) =>
    supabase.from('trips').select('id, status, trip_number, client_request_number').in('id', chunk),
  );
  const tripById = new Map(((trips ?? []) as any[]).map((t) => [t.id, t]));
  const items: AdvanceItem[] = [];
  for (const r of rows) {
    const mine = allocs.filter((a) => a.bank_transaction_id === r.id);
    const spread = mine.reduce((s, a) => s + Number(a.amount), 0);
    const unallocated = Math.round((Number(r.amount) - spread) * 100) / 100;
    const onTrips = mine
      .filter((a) => {
        const st = tripById.get(a.trip_id)?.status;
        return st && st !== 'invoiced' && st !== 'paid';
      })
      .map((a) => {
        const tr = tripById.get(a.trip_id);
        return { tripId: a.trip_id, label: String(tr?.client_request_number ?? tr?.trip_number ?? '?'), amount: Number(a.amount) };
      });
    if (unallocated > 0.5 || onTrips.length) {
      items.push({
        txId: r.id,
        date: String(r.booking_date).slice(0, 10),
        counterparty: r.counterparty,
        currency: r.currency,
        amount: Number(r.amount),
        unallocated: Math.max(0, unallocated),
        onTrips,
      });
    }
  }
  return { items, pendingCount: pendingCount ?? 0 };
}
