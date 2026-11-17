import 'server-only';
import type { createClient } from '../supabase/admin';
import { parsePkoStatement, type ParseError } from './pko-rules';
import { classifyTx, defaultOverhead, matchPurchases, matchTrips, allocatePayment, type TxKind, type PurchaseRef, type TripRef, type Allocation } from './match-rules';
import { fetchAll } from '../fetch-all';
import { loadPurchaseRefs, loadTripRefs } from './refs';
import { applyDecision, insertCashCost, type Decision } from './apply';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Suggestion =
  | { type: 'cash' }
  | { type: 'purchases'; ids: string[]; exact: boolean }
  | { type: 'trips'; ids: string[]; exact: boolean; allocations?: Allocation[]; remainder?: number }
  | { type: 'overhead'; category: string }
  | { type: 'ignore' };

/** Подсказка для операции: свои переводы — пропустить; приход — заказы; расход — счета или категория. */
export function suggestFor(
  t: Parameters<typeof matchPurchases>[0],
  kind: TxKind,
  purchases: PurchaseRef[],
  trips: TripRef[],
): Suggestion | null {
  if (kind === 'internal') return { type: 'ignore' };
  // Наличные — не расход: деньги переходят в кассу/водителю, расход — когда их потратят (расходы рейса).
  if (kind === 'cash' && t.amount < 0) {
    // «ZWROT KOSZTÓW» — сотрудник заплатил за фирму, ему вернули: это оплата его счёта
    // (Everprint, принтер), если счёт с той же суммой есть. Иначе — как наличные.
    if (/ZWROT KOSZT|WZROT/i.test(t.title ?? '')) {
      const m = matchPurchases(t, 'other_out', purchases);
      if (m) return { type: 'purchases', ids: m.ids, exact: false };
    }
    return { type: 'cash' };
  }
  if (t.amount > 0) {
    const m = kind === 'client' ? matchTrips(t, trips) : null;
    return m ? { type: 'trips', ...m } : null;
  }
  const m = ['supplier', 'other_out', 'card'].includes(kind) ? matchPurchases(t, kind, purchases) : null;
  const cat = defaultOverhead(kind, t);
  return m ? { type: 'purchases', ...m } : cat ? { type: 'overhead', category: cat } : null;
}

/** Однозначное решение по подсказке — применяется без человека. */
export const autoDecision = (sg: Suggestion | null): Decision | null => {
  if (sg?.type === 'ignore') return { type: 'ignore' };
  if (sg?.type === 'purchases' && sg.exact) return { type: 'purchases', ids: sg.ids };
  if (sg?.type === 'trips' && sg.exact) return { type: 'trips', ids: sg.ids, allocations: sg.allocations };
  return null;
};

/** Точная подсказка по заказам займёт их остаток — учесть для следующих операций той же загрузки. */
function reserve(sg: Suggestion | null, trips: TripRef[]) {
  if (sg?.type !== 'trips' || !sg.exact) return;
  for (const a of sg.allocations ?? []) {
    const t = trips.find((x) => x.id === a.tripId);
    if (t) t.allocated = (t.allocated ?? 0) + a.amount;
  }
}

/**
 * Пересчитать подсказки для операций без решения (после правки данных: валюта счетов,
 * новые счета из KSeF) и применить однозначные. Возвращает, сколько применено.
 */
export async function rematchPending(supabase: Supabase, userId: string | null): Promise<{ checked: number; auto: number }> {
  // Приходы, разнесённые до миграции 044 (без долей), — доли по остаткам заказов, по порядку.
  const { data: oldTrips, error: allocErr } = await supabase
    .from('bank_transactions')
    .select('id, amount, currency, trip_ids')
    .eq('status', 'matched')
    .gt('amount', 0);
  if (!allocErr) {
    const { data: have } = await fetchAll(supabase.from('payment_allocations').select('bank_transaction_id').order('id'));
    const done = new Set(((have ?? []) as { bank_transaction_id: string }[]).map((r) => r.bank_transaction_id));
    const pending = ((oldTrips ?? []) as any[]).filter((r) => (r.trip_ids ?? []).length && !done.has(r.id));
    if (pending.length) {
      const refs = await loadTripRefs(supabase);
      for (const r of pending) {
        const ordered = (r.trip_ids as string[]).map((id) => refs.find((x) => x.id === id)).filter((x): x is TripRef => Boolean(x));
        const { allocations } = allocatePayment(Number(r.amount), String(r.currency).toUpperCase(), ordered);
        if (!allocations.length) continue;
        const { error } = await supabase
          .from('payment_allocations')
          .insert(allocations.map((a) => ({ bank_transaction_id: r.id, trip_id: a.tripId, amount: a.amount, currency: r.currency, created_by: userId })));
        if (!error) for (const a of allocations) {
          const t = refs.find((x) => x.id === a.tripId);
          if (t) t.allocated = (t.allocated ?? 0) + a.amount;
        }
      }
    }
  }
  // Наличные, решённые до миграции 043, — строка «снятие наличных» вне P&L, если её ещё нет.
  const { data: cash } = await supabase
    .from('bank_transactions')
    .select('id, amount, currency, booking_date, counterparty, title, op_type')
    .eq('status', 'matched')
    .eq('overhead_category', 'cash');
  for (const c of (cash ?? []) as any[]) {
    const { data: has, error } = await supabase.from('fixed_costs').select('id').eq('bank_transaction_id', c.id).maybeSingle();
    if (!error && !has) await insertCashCost(supabase, c);
  }

  const { data } = await fetchAll(
    supabase
      .from('bank_transactions')
      .select('id, kind, amount, currency, booking_date, op_type, counterparty, counterparty_account, title, description')
      .eq('status', 'new')
      .order('id'),
  );
  const rows = (data ?? []) as any[];
  if (!rows.length) return { checked: 0, auto: 0 };
  const [purchases, trips] = await Promise.all([loadPurchaseRefs(supabase), loadTripRefs(supabase)]);
  let auto = 0;
  for (const r of rows) {
    const sg = suggestFor(
      {
        type: r.op_type ?? '',
        amount: Number(r.amount),
        counterparty: r.counterparty,
        counterpartyAccount: r.counterparty_account,
        title: r.title,
        description: r.description ?? '',
        bookingDate: String(r.booking_date).slice(0, 10),
        currency: r.currency,
      },
      r.kind as TxKind,
      purchases,
      trips,
    );
    reserve(sg, trips);
    await supabase.from('bank_transactions').update({ suggestion: sg }).eq('id', r.id).eq('status', 'new');
    const d = autoDecision(sg);
    if (d && (await applyDecision(supabase, r.id, d, userId)).ok) auto++;
  }
  return { checked: rows.length, auto };
}

export type ImportResult =
  | { ok: true; statementId: string; total: number; auto: number; toReview: number; period: string; account: string }
  | { ok: false; error: ParseError | 'exists' | 'db'; message?: string };

/** Загрузить выписку: разобрать, сохранить операции с подсказками, точные совпадения — применить. */
export async function importStatement(
  supabase: Supabase,
  lines: string[],
  fileName: string,
  userId: string | null,
): Promise<ImportResult> {
  const parsed = parsePkoStatement(lines);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const s = parsed.statement;

  const { data: st, error } = await supabase
    .from('bank_statements')
    .insert({
      account: s.account,
      currency: s.currency,
      period_from: s.periodFrom,
      period_to: s.periodTo,
      number: s.number,
      opening_balance: s.openingBalance,
      closing_balance: s.closingBalance,
      file_name: fileName.slice(0, 200),
      created_by: userId,
    })
    .select('id')
    .single();
  if (error) return /duplicate key|unique/i.test(error.message) ? { ok: false, error: 'exists' } : { ok: false, error: 'db', message: error.message };

  // Свои счета: этот и все уже загруженные — переводы между ними не доход и не расход.
  const { data: accts } = await supabase.from('bank_statements').select('account');
  const own = [...new Set([s.account, ...((accts ?? []) as { account: string }[]).map((a) => a.account)])];
  const [purchases, trips] = await Promise.all([loadPurchaseRefs(supabase), loadTripRefs(supabase)]);

  const rows = s.transactions.map((t) => {
    const kind = classifyTx(t, own);
    const suggestion = suggestFor({ ...t, currency: s.currency }, kind, purchases, trips);
    reserve(suggestion, trips);
    return {
      statement_id: st.id,
      account: s.account,
      currency: s.currency,
      seq: t.seq,
      booking_date: t.bookingDate,
      value_date: t.valueDate,
      operation_id: t.operationId,
      op_type: t.type,
      amount: t.amount,
      balance: t.balance,
      description: t.description.slice(0, 2000),
      counterparty: t.counterparty?.slice(0, 300) ?? null,
      counterparty_account: t.counterpartyAccount,
      title: t.title?.slice(0, 500) ?? null,
      kind,
      suggestion,
    };
  });
  const { data: inserted, error: txErr } = await supabase.from('bank_transactions').insert(rows).select('id, suggestion');
  if (txErr) {
    await supabase.from('bank_statements').delete().eq('id', st.id);
    return { ok: false, error: 'db', message: txErr.message };
  }

  // Применяем сразу только однозначное: точное совпадение счетов/заказов и свои переводы.
  let auto = 0;
  for (const r of (inserted ?? []) as { id: string; suggestion: Suggestion | null }[]) {
    const d = autoDecision(r.suggestion);
    if (!d) continue;
    const res = await applyDecision(supabase, r.id, d, userId);
    if (res.ok) auto++;
  }
  return {
    ok: true,
    statementId: st.id,
    total: rows.length,
    auto,
    toReview: rows.length - auto,
    period: `${s.periodFrom} – ${s.periodTo}`,
    account: s.account,
  };
}
