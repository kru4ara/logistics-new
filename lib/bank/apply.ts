import 'server-only';
import type { createClient } from '../supabase/admin';
import { toEur } from '../fx';
import { isMonthClosed } from '../closed-months';
import { providerById } from '../invoicing';
import { isOverheadCategory } from '../payables/overhead-rules';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Решение по операции выписки. */
export type Decision =
  | { type: 'purchases'; ids: string[] } // оплата счетов подрядчиков
  | { type: 'trips'; ids: string[] } // оплата заказов клиентом
  | { type: 'overhead'; category: string } // общий расход без счёта (ZUS, наличные, комиссии…)
  | { type: 'cash' } // наличные: снятие / выдача людям — не расход, в «Общие расходы» не идёт
  | { type: 'ignore' };

export type ApplyError = 'notFound' | 'decided' | 'direction' | 'category' | 'closed' | 'empty' | 'db';

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
    const { error } = await done({ status: 'matched', overhead_category: 'cash' });
    return error ? { ok: false, error: 'db', message: error.message } : { ok: true };
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
    if (!d.ids.length) return { ok: false, error: 'empty' };
    const { data: trips } = await supabase
      .from('trips')
      .select('id, status, paid_at, invoice_provider, invoice_external_id')
      .in('id', d.ids);
    if ((trips ?? []).length !== d.ids.length) return { ok: false, error: 'notFound' };
    const { error } = await supabase
      .from('trips')
      .update({ status: 'paid', paid_at: date })
      .in('id', d.ids)
      .in('status', ['invoiced', 'paid']);
    if (error) return { ok: false, error: 'db', message: error.message };
    // Оплату отмечаем и в сервисе фактур (как кнопка в дебиторке); сбой там не отменяет оплату.
    for (const t of (trips ?? []) as any[]) {
      if (t.status === 'paid') continue;
      const provider = providerById(t.invoice_provider);
      if (provider && t.invoice_external_id) {
        await provider.markPaid(t.invoice_external_id).catch((e: unknown) =>
          console.error('[bank] invoice paid', provider.id, e instanceof Error ? e.message : e),
        );
      }
    }
    const undo: Undo = { trips: ((trips ?? []) as any[]).map((t) => ({ id: t.id, status: t.status, paid_at: t.paid_at ?? null })) };
    const { error: e2 } = await done({ status: 'matched', trip_ids: d.ids, undo });
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

/** Отменить решение: вернуть прежние даты оплаты и статусы, удалить общий расход. */
export async function undoDecision(supabase: Supabase, txId: string): Promise<{ ok: true } | { ok: false; error: ApplyError; message?: string }> {
  const { data } = await supabase
    .from('bank_transactions')
    .select('id, status, booking_date, purchase_invoice_ids, trip_ids, overhead_category, undo')
    .eq('id', txId)
    .maybeSingle();
  if (!data) return { ok: false, error: 'notFound' };
  const undo = (data.undo ?? {}) as Undo;
  if (data.overhead_category && data.overhead_category !== 'cash') {
    if (await isMonthClosed(supabase, String(data.booking_date).slice(0, 7))) return { ok: false, error: 'closed' };
    await supabase.from('fixed_costs').delete().eq('bank_transaction_id', txId);
  }
  for (const p of undo.purchases ?? []) {
    await supabase.from('purchase_invoices').update({ paid_at: p.paid_at, bank_transaction_id: null, updated_at: now() }).eq('id', p.id).eq('bank_transaction_id', txId);
  }
  for (const t of undo.trips ?? []) {
    await supabase.from('trips').update({ status: t.status, paid_at: t.paid_at }).eq('id', t.id);
  }
  const { error } = await supabase
    .from('bank_transactions')
    .update({ status: 'new', purchase_invoice_ids: [], trip_ids: [], overhead_category: null, undo: null, decided_by: null, decided_at: null })
    .eq('id', txId);
  return error ? { ok: false, error: 'db', message: error.message } : { ok: true };
}
