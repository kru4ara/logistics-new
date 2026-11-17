import 'server-only';
import type { createClient } from '../supabase/admin';
import { parsePkoStatement, type ParseError } from './pko-rules';
import { classifyTx, defaultOverhead, matchPurchases, matchTrips } from './match-rules';
import { loadPurchaseRefs, loadTripRefs } from './refs';
import { applyDecision, type Decision } from './apply';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type Suggestion =
  | { type: 'purchases'; ids: string[]; exact: boolean }
  | { type: 'trips'; ids: string[]; exact: boolean }
  | { type: 'overhead'; category: string }
  | { type: 'ignore' };

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
    const ctx = { ...t, currency: s.currency };
    let suggestion: Suggestion | null = null;
    if (kind === 'internal') suggestion = { type: 'ignore' };
    else if (t.amount > 0) {
      const m = kind === 'client' ? matchTrips(ctx, trips) : null;
      suggestion = m ? { type: 'trips', ...m } : null;
    } else {
      const m = ['supplier', 'other_out', 'card'].includes(kind) ? matchPurchases(ctx, kind, purchases) : null;
      const cat = defaultOverhead(kind, t);
      suggestion = m ? { type: 'purchases', ...m } : cat ? { type: 'overhead', category: cat } : null;
    }
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
    const sg = r.suggestion;
    const d: Decision | null =
      sg?.type === 'ignore' ? { type: 'ignore' } : (sg?.type === 'purchases' || sg?.type === 'trips') && sg.exact ? { type: sg.type, ids: sg.ids } : null;
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
