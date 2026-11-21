import 'server-only';
import type { createClient } from '../supabase/admin';
import { toEur } from '../fx';
import { isMonthClosed } from '../closed-months';
import { providerById } from '../invoicing';
import { isOverheadCategory } from '../payables/overhead-rules';
import { allocatePayment, isSettled, type Allocation, type TripRef } from './match-rules';
import { loadTripRefs } from './refs';
import { isIncomeCategory, incomeDecision, incomeCategoryOf } from '../other-income';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Решение по операции выписки. */
export type Decision =
  | { type: 'purchases'; ids: string[] } // оплата счетов подрядчиков
  | { type: 'trips'; ids: string[]; allocations?: Allocation[] } // оплата заказов клиентом: доли по заказам
  | { type: 'overhead'; category: string } // общий расход без счёта (ZUS, наличные, комиссии…)
  | { type: 'cash' } // наличные: снятие / выдача людям — не расход, в «Общие расходы» не идёт
  | { type: 'income'; category: string } // прочий доход: компенсация, возврат, проценты (миграция 045)
  | { type: 'ignore' };

export type ApplyError = 'notFound' | 'decided' | 'direction' | 'category' | 'closed' | 'empty' | 'db' | 'overAllocated' | 'badShare';

type Tx = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  booking_date: string;
  counterparty: string | null;
  title: string | null;
  op_type: string | null;
  purchase_invoice_ids: string[];
  trip_ids: string[];
  undo: Undo | null;
};

type Undo = {
  purchases?: { id: string; paid_at: string | null }[];
  trips?: { id: string; status: string; paid_at: string | null }[];
};

const now = () => new Date().toISOString();

/** Применить решение: оплаты получают дату из выписки, общий расход — строку «Общих расходов». */
export async function applyDecision(
  supabase: Supabase,
  txId: string,
  d: Decision,
  userId: string | null,
): Promise<{ ok: true } | { ok: false; error: ApplyError; message?: string }> {
  const { data } = await supabase
    .from('bank_transactions')
    .select('id, status, amount, currency, booking_date, counterparty, title, op_type, purchase_invoice_ids, trip_ids, undo')
    .eq('id', txId)
    .maybeSingle();
  const tx = data as Tx | null;
  if (!tx) return { ok: false, error: 'notFound' };
  if (tx.status !== 'new') return { ok: false, error: 'decided' };
  const amount = Number(tx.amount);
  const date = String(tx.booking_date).slice(0, 10);
  const done = (patch: Record<string, unknown>) =>
    supabase
      .from('bank_transactions')
      .update({ ...patch, decided_by: userId, decided_at: now() })
      .eq('id', txId)
      .eq('status', 'new');

  if (d.type === 'ignore') {
    const { error } = await done({ status: 'ignored' });
    return error ? { ok: false, error: 'db', message: error.message } : { ok: true };
  }

  if (d.type === 'cash') {
    if (amount >= 0) return { ok: false, error: 'direction' };
    // Видно в «Общих расходах» отдельной строкой «снятие наличных», вне P&L (миграция 043).
    await insertCashCost(supabase, { id: txId, amount, currency: tx.currency, booking_date: date, counterparty: tx.counterparty, title: tx.title, op_type: tx.op_type });
    const { error } = await done({ status: 'matched', overhead_category: 'cash' });
    return error ? { ok: false, error: 'db', message: error.message } : { ok: true };
  }

  if (d.type === 'income') {
    if (amount <= 0) return { ok: false, error: 'direction' };
    if (!isIncomeCategory(d.category)) return { ok: false, error: 'category' };
    if (await isMonthClosed(supabase, date.slice(0, 7))) return { ok: false, error: 'closed' };
    const label = [tx.counterparty || tx.op_type, tx.title].filter(Boolean).join(' · ').slice(0, 300);
    const { error } = await supabase.from('other_income').insert({
      income_date: date,
      month_key: date.slice(0, 7),
      category: d.category,
      description: label || null,
      original_amount: amount,
      currency: tx.currency,
      amount_eur: await toEur(supabase, amount, tx.currency, date),
      bank_transaction_id: txId,
      created_by: userId,
    });
    if (error) return { ok: false, error: 'db', message: error.message };
    const { error: e2 } = await done({ status: 'matched', overhead_category: incomeDecision(d.category) });
    return e2 ? { ok: false, error: 'db', message: e2.message } : { ok: true };
  }

  if (d.type === 'purchases') {
    if (amount >= 0) return { ok: false, error: 'direction' };
    if (!d.ids.length) return { ok: false, error: 'empty' };
    const { data: invs } = await supabase.from('purchase_invoices').select('id, paid_at').in('id', d.ids);
    if ((invs ?? []).length !== d.ids.length) return { ok: false, error: 'notFound' };
    const { error } = await supabase
      .from('purchase_invoices')
      .update({ paid_at: date, bank_transaction_id: txId, updated_at: now() })
      .in('id', d.ids);
    if (error) return { ok: false, error: 'db', message: error.message };
    const undo: Undo = { purchases: (invs ?? []).map((i) => ({ id: i.id as string, paid_at: (i.paid_at as string | null) ?? null })) };
    const { error: e2 } = await done({ status: 'matched', purchase_invoice_ids: d.ids, undo });
    return e2 ? { ok: false, error: 'db', message: e2.message } : { ok: true };
  }

  if (d.type === 'trips') {
    if (amount <= 0) return { ok: false, error: 'direction' };
    const ids = [...new Set(d.ids)];
    if (!ids.length) return { ok: false, error: 'empty' };
    const { data: trips } = await supabase
      .from('trips')
      .select('id, status, paid_at, invoice_provider, invoice_external_id')
      .in('id', ids);
    if ((trips ?? []).length !== ids.length) return { ok: false, error: 'notFound' };

    // Доли: присланные или — по остаткам заказов (подсказка без долей).
    let allocs: Allocation[] = d.allocations ?? [];
    if (!d.allocations) {
      const refs = (await loadTripRefs(supabase)).filter((r) => ids.includes(r.id));
      const ordered = ids.map((id) => refs.find((r) => r.id === id)).filter((r): r is TripRef => Boolean(r));
      allocs = allocatePayment(amount, String(tx.currency).toUpperCase(), ordered).allocations;
    }
    allocs = allocs.map((x) => ({ tripId: String(x.tripId), amount: Math.round(Number(x.amount) * 100) / 100 }));
    const bad = validateTripAllocations(amount, ids, allocs);
    if (bad) return { ok: false, error: bad };

    if (allocs.length) {
      const { error } = await supabase.from('payment_allocations').insert(
        allocs.map((x) => ({ bank_transaction_id: txId, trip_id: x.tripId, amount: x.amount, currency: tx.currency, created_by: userId })),
      );
      if (error) return { ok: false, error: 'db', message: error.message };
    }
    const undo: Undo = { trips: ((trips ?? []) as any[]).map((t) => ({ id: t.id, status: t.status, paid_at: t.paid_at ?? null })) };
    await settleTrips(supabase, ids);
    const { error: e2 } = await done({ status: 'matched', trip_ids: ids, undo });
    return e2 ? { ok: false, error: 'db', message: e2.message } : { ok: true };
  }

  // Общий расход без счёта.
  if (amount >= 0) return { ok: false, error: 'direction' };
  if (!isOverheadCategory(d.category)) return { ok: false, error: 'category' };
  if (await isMonthClosed(supabase, date.slice(0, 7))) return { ok: false, error: 'closed' };
  const value = -amount;
  const capex = d.category === 'capex';
  const label = [tx.counterparty || tx.op_type, tx.title].filter(Boolean).join(' · ').slice(0, 300);
  const { error } = await supabase.from('fixed_costs').insert({
    month_key: date.slice(0, 7),
    category: label || tx.op_type || 'Bank',
    cost_type: 'one_time',
    expense_date: date,
    currency: tx.currency,
    original_amount: value,
    amount_eur: await toEur(supabase, value, tx.currency, date),
    amount_pln: tx.currency === 'PLN' ? value : null,
    is_capex: capex,
    capex_rule: capex ? 'invoice' : 'none',
    bank_transaction_id: txId,
  });
  if (error) return { ok: false, error: 'db', message: error.message };
  const { error: e2 } = await done({ status: 'matched', overhead_category: d.category });
  return e2 ? { ok: false, error: 'db', message: e2.message } : { ok: true };
}

/** Доли прихода по заказам: заказы из решения, суммы > 0, в сумме не больше прихода. */
export function validateTripAllocations(amount: number, ids: string[], allocs: Allocation[]): 'overAllocated' | 'badShare' | null {
  if (allocs.some((x) => !ids.includes(x.tripId) || !Number.isFinite(x.amount) || x.amount <= 0)) return 'badShare';
  if (new Set(allocs.map((x) => x.tripId)).size !== allocs.length) return 'badShare';
  const sum = allocs.reduce((t, x) => t + Math.round(x.amount * 100), 0);
  return sum > Math.round(amount * 100) + 1 ? 'overAllocated' : null;
}

/**
 * Заказы, оплаченные полностью по распределённым приходам, — «оплачен» с датой последнего
 * прихода (и отметка в сервисе фактур). Только выставленные: аванс до счёта ждёт счёта
 * (вызывается и при выставлении). Уже оплаченным — дата оплаты по выписке.
 */
export async function settleTrips(supabase: Supabase, tripIds: string[]): Promise<void> {
  if (!tripIds.length) return;
  const refs = (await loadTripRefs(supabase)).filter((r) => tripIds.includes(r.id));
  const { data: rows, error } = await supabase
    .from('payment_allocations')
    .select('trip_id, bank_transactions(booking_date)')
    .in('trip_id', tripIds);
  if (error) return;
  const lastDate = new Map<string, string>();
  for (const r of (rows ?? []) as any[]) {
    const bt = Array.isArray(r.bank_transactions) ? r.bank_transactions[0] : r.bank_transactions;
    const dt = bt?.booking_date ? String(bt.booking_date).slice(0, 10) : null;
    if (dt && (!lastDate.has(r.trip_id) || dt > lastDate.get(r.trip_id)!)) lastDate.set(r.trip_id, dt);
  }
  const { data: trips } = await supabase.from('trips').select('id, status, invoice_provider, invoice_external_id').in('id', tripIds);
  for (const t of (trips ?? []) as any[]) {
    const ref = refs.find((r) => r.id === t.id);
    const when = lastDate.get(t.id);
    // Доли — в валюте прихода (EUR); счёт по ошибке в другой валюте — сверяем с фрахтом в EUR.
    const base = (ref?.currency || 'EUR').toUpperCase() === 'EUR' ? ref?.amount ?? null : ref?.revenueEur ?? ref?.amount ?? null;
    if (!ref || !when || !isSettled(base, ref.allocated ?? 0)) continue;
    if (t.status !== 'invoiced' && t.status !== 'paid') continue;
    await supabase.from('trips').update({ status: 'paid', paid_at: when }).eq('id', t.id);
    if (t.status === 'invoiced') {
      const provider = providerById(t.invoice_provider);
      if (provider && t.invoice_external_id) {
        await provider.markPaid(t.invoice_external_id).catch((e: unknown) =>
          console.error('[bank] invoice paid', provider.id, e instanceof Error ? e.message : e),
        );
      }
    }
  }
}

/**
 * Строка «снятие наличных» в «Общих расходах» (cost_class = 'cash', вне P&L).
 */
export async function insertCashCost(
  supabase: Supabase,
  tx: { id: string; amount: number; currency: string; booking_date: string; counterparty: string | null; title: string | null; op_type: string | null },
): Promise<void> {
  const value = -Number(tx.amount);
  const date = String(tx.booking_date).slice(0, 10);
  const label = [tx.counterparty || tx.op_type, tx.title].filter(Boolean).join(' · ').slice(0, 300);
  await supabase.from('fixed_costs').insert({
    month_key: date.slice(0, 7),
    category: label || 'Cash',
    cost_type: 'one_time',
    expense_date: date,
    currency: tx.currency,
    original_amount: value,
    amount_eur: await toEur(supabase, value, tx.currency, date),
    amount_pln: tx.currency === 'PLN' ? value : null,
    is_capex: false,
    capex_rule: 'none',
    cost_class: 'cash',
    bank_transaction_id: tx.id,
  });
}

/** Отменить решение: вернуть прежние даты оплаты и статусы, удалить общий расход. */
export async function undoDecision(supabase: Supabase, txId: string): Promise<{ ok: true } | { ok: false; error: ApplyError; message?: string }> {
  const { data } = await supabase
    .from('bank_transactions')
    .select('id, status, booking_date, purchase_invoice_ids, trip_ids, overhead_category, undo')
    .eq('id', txId)
    .maybeSingle();
  if (!data) return { ok: false, error: 'notFound' };
  const undo = (data.undo ?? {}) as Undo;
  if (data.overhead_category) {
    // Наличные вне P&L — закрытый месяц не мешает.
    if (data.overhead_category !== 'cash' && (await isMonthClosed(supabase, String(data.booking_date).slice(0, 7)))) {
      return { ok: false, error: 'closed' };
    }
    if (incomeCategoryOf(data.overhead_category)) await supabase.from('other_income').delete().eq('bank_transaction_id', txId);
    else await supabase.from('fixed_costs').delete().eq('bank_transaction_id', txId);
  }
  for (const p of undo.purchases ?? []) {
    await supabase.from('purchase_invoices').update({ paid_at: p.paid_at, bank_transaction_id: null, updated_at: now() }).eq('id', p.id).eq('bank_transaction_id', txId);
  }
  // Доли этого прихода — прочь; заказам — прежние статус и дата оплаты.
  await supabase.from('payment_allocations').delete().eq('bank_transaction_id', txId);
  for (const t of undo.trips ?? []) {
    await supabase.from('trips').update({ status: t.status, paid_at: t.paid_at }).eq('id', t.id);
  }
  const { error } = await supabase
    .from('bank_transactions')
    .update({ status: 'new', purchase_invoice_ids: [], trip_ids: [], overhead_category: null, undo: null, decided_by: null, decided_at: null })
    .eq('id', txId);
  return error ? { ok: false, error: 'db', message: error.message } : { ok: true };
}
