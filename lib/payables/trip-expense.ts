import 'server-only';
import type { createClient } from '../supabase/admin';
import { fetchAll, fetchAllByIds } from '../fetch-all';
import { toEur } from '../fx';
import { costAmount } from './cost-rules';
import { normalizeNip } from './match-rules';
import { scaleAllocations, type Allocation, type TripCandidate } from './trip-rules';

type Supabase = Awaited<ReturnType<typeof createClient>>;

const iso = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : null);

/**
 * Строки расхода рейса из счёта — по одной на рейс (доля счёта). Нет trip_id у счёта —
 * всё удаляется. allocations — при привязке/разделении; без них: одна строка на trip_id
 * или прежние доли, пересчитанные под текущую сумму счёта (korekta). category — при
 * привязке; без неё остаётся прежняя. До миграции 039 вторая строка на счёт не
 * вставится — тогда { ok: false, error: 'migration' }.
 */
export async function syncInvoiceTripExpense(
  supabase: Supabase,
  invoiceId: string,
  category?: string,
  allocations?: Allocation[],
): Promise<{ ok: boolean; error?: 'migration' | string }> {
  const { data: inv } = await supabase
    .from('purchase_invoices')
    .select('id, trip_id, invoice_number, seller_name, net_amount, gross_amount, currency, issue_date')
    .eq('id', invoiceId)
    .maybeSingle();
  const { data: rows } = await supabase
    .from('trip_expenses')
    .select('id, trip_id, category, original_amount')
    .eq('purchase_invoice_id', invoiceId)
    .order('created_at')
    .order('id');
  const existing = (rows ?? []) as { id: string; trip_id: string; category: string | null; original_amount: number | null }[];
  if (!inv?.trip_id) {
    if (existing.length) await supabase.from('trip_expenses').delete().eq('purchase_invoice_id', invoiceId);
    return { ok: true };
  }
  const total = costAmount({
    net: inv.net_amount != null ? Number(inv.net_amount) : null,
    gross: inv.gross_amount != null ? Number(inv.gross_amount) : null,
  }) ?? 0;
  const desired: Allocation[] =
    allocations ??
    (existing.length > 1
      ? scaleAllocations(existing.map((r) => ({ tripId: r.trip_id, amount: Number(r.original_amount ?? 0) })), total)
      : [{ tripId: inv.trip_id as string, amount: total }]);
  const date = iso(inv.issue_date) ?? new Date().toISOString().slice(0, 10);
  const cat = category ?? existing[0]?.category ?? 'other';
  const base = {
    segment_id: null,
    category: cat,
    currency: inv.currency || 'PLN',
    expense_date: date,
    description: [inv.seller_name, inv.invoice_number].filter(Boolean).join(' · ') + (desired.length > 1 ? ` (1/${desired.length})` : ''),
    paid_by_driver: false,
    liters: null,
  };
  const byTrip = new Map(existing.map((r) => [r.trip_id, r]));
  // Сначала вставка и обновление, потом удаление лишних: при ошибке ничего не теряем.
  for (const a of desired) {
    const fields = { ...base, trip_id: a.tripId, original_amount: a.amount, amount_eur: await toEur(supabase, a.amount, inv.currency, date) };
    const prev = byTrip.get(a.tripId);
    const { error } = prev
      ? await supabase.from('trip_expenses').update(fields).eq('id', prev.id)
      : await supabase.from('trip_expenses').insert({ ...fields, purchase_invoice_id: invoiceId });
    if (error) return { ok: false, error: /duplicate key|unique/i.test(error.message) ? 'migration' : error.message };
  }
  const keep = new Set(desired.map((a) => a.tripId));
  const extra = existing.filter((r) => !keep.has(r.trip_id)).map((r) => r.id);
  if (extra.length) await supabase.from('trip_expenses').delete().in('id', extra);
  return { ok: true };
}

/** Доли счёта по рейсам (для подписи «Рейс №… +2»). */
export async function loadInvoiceTrips(supabase: Supabase, invoiceIds: string[]): Promise<Map<string, string[]>> {
  const m = new Map<string, string[]>();
  if (!invoiceIds.length) return m;
  const { data } = await fetchAllByIds(invoiceIds, (chunk) =>
    supabase.from('trip_expenses').select('purchase_invoice_id, trip_id').in('purchase_invoice_id', chunk),
  );
  for (const r of (data ?? []) as { purchase_invoice_id: string; trip_id: string }[]) {
    m.set(r.purchase_invoice_id, [...(m.get(r.purchase_invoice_id) ?? []), r.trip_id]);
  }
  return m;
}

/** Рейсы для выбора в «Счетах подрядчиков»: за последний год, новые первыми. */
export async function loadTripCandidates(supabase: Supabase, extraIds: string[] = []): Promise<TripCandidate[]> {
  const SELECT = 'id, trip_number, client_request_number, start_date, end_date, clients(name), trucks!truck_id(registration_number)';
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await fetchAll(supabase.from('trips').select(SELECT).gte('start_date', since).order('start_date', { ascending: false }).order('id'));
  const rows = [...((data ?? []) as any[])];
  const have = new Set(rows.map((r) => r.id));
  const missing = extraIds.filter((id) => !have.has(id));
  if (missing.length) {
    const { data: more } = await supabase.from('trips').select(SELECT).in('id', missing.slice(0, 200));
    rows.push(...((more ?? []) as any[]));
  }
  return rows.map((r) => {
    const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
    const client = one(r.clients as { name: string | null } | null)?.name ?? null;
    const truck = one(r.trucks as { registration_number: string | null } | null)?.registration_number ?? null;
    const number = r.client_request_number || r.trip_number || null;
    return {
      id: r.id,
      number,
      clientName: client,
      start: iso(r.start_date),
      end: iso(r.end_date),
      truck,
      label: '',
    };
  });
}

/** Категория прошлых счетов-расходов рейса по NIP продавца — подставить по умолчанию. */
export async function lastTripCategoryByNip(supabase: Supabase): Promise<Map<string, string>> {
  const { data } = await fetchAll(
    supabase
      .from('trip_expenses')
      .select('category, created_at, purchase_invoices!purchase_invoice_id!inner(seller_nip)')
      .not('purchase_invoice_id', 'is', null)
      .order('created_at', { ascending: true })
      .order('id'),
  );
  const m = new Map<string, string>();
  for (const r of (data ?? []) as any[]) {
    const pi = Array.isArray(r.purchase_invoices) ? r.purchase_invoices[0] : r.purchase_invoices;
    const n = normalizeNip(pi?.seller_nip);
    if (n && r.category) m.set(n, r.category);
  }
  return m;
}
