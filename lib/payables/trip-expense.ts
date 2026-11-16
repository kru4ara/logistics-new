import 'server-only';
import type { createClient } from '../supabase/admin';
import { fetchAll } from '../fetch-all';
import { toEur } from '../fx';
import { costAmount } from './cost-rules';
import { normalizeNip } from './match-rules';
import type { TripCandidate } from './trip-rules';

type Supabase = Awaited<ReturnType<typeof createClient>>;

const iso = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : null);

/**
 * Строка расхода рейса из счёта (одна на счёт): создать, обновить или удалить, если счёт
 * больше не привязан к рейсу. category — при привязке; без неё остаётся прежняя.
 */
export async function syncInvoiceTripExpense(supabase: Supabase, invoiceId: string, category?: string): Promise<void> {
  const { data: inv } = await supabase
    .from('purchase_invoices')
    .select('id, trip_id, invoice_number, seller_name, net_amount, gross_amount, currency, issue_date')
    .eq('id', invoiceId)
    .maybeSingle();
  const { data: existing } = await supabase.from('trip_expenses').select('id, category').eq('purchase_invoice_id', invoiceId).maybeSingle();
  if (!inv?.trip_id) {
    if (existing) await supabase.from('trip_expenses').delete().eq('id', existing.id);
    return;
  }
  const amount = costAmount({
    net: inv.net_amount != null ? Number(inv.net_amount) : null,
    gross: inv.gross_amount != null ? Number(inv.gross_amount) : null,
  }) ?? 0;
  const date = iso(inv.issue_date) ?? new Date().toISOString().slice(0, 10);
  const fields = {
    trip_id: inv.trip_id,
    segment_id: null,
    category: category ?? existing?.category ?? 'other',
    original_amount: amount,
    currency: inv.currency || 'PLN',
    amount_eur: await toEur(supabase, amount, inv.currency, date),
    expense_date: date,
    description: [inv.seller_name, inv.invoice_number].filter(Boolean).join(' · '),
    paid_by_driver: false,
    liters: null,
  };
  if (existing) await supabase.from('trip_expenses').update(fields).eq('id', existing.id);
  else await supabase.from('trip_expenses').insert({ ...fields, purchase_invoice_id: invoiceId });
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
