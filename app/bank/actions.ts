'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '../../lib/require-office';
import { createClient } from '../../lib/supabase/admin';
import { getSessionContext } from '../../lib/session';
import { logAudit } from '../../lib/audit';
import { getT } from '../../lib/i18n/server';
import type { MessageKey } from '../../lib/i18n/translate';
import { pdfLines } from '../../lib/bank/pdf-text';
import { importStatement, rematchPending, autoDecision } from '../../lib/bank/import';
import { applyDecision, undoDecision, type Decision } from '../../lib/bank/apply';

type Result = { ok: boolean; message?: string };

const MAX_FILES = 12;
const MAX_BYTES = 5 * 1024 * 1024;

const refresh = () => {
  revalidatePath('/bank');
  revalidatePath('/payables');
  revalidatePath('/receivables');
  revalidatePath('/fixed-costs');
};

/** Загрузить выписки PKO (PDF, несколько файлов). */
export async function uploadStatements(formData: FormData): Promise<Result> {
  await requireCapability('bank.edit');
  const { t } = await getT();
  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, message: t('bank.errNoFile') };
  if (files.length > MAX_FILES) return { ok: false, message: t('bank.errTooMany', { n: MAX_FILES }) };
  const supabase = await createClient();
  const { userId } = await getSessionContext();
  const lines: string[] = [];
  for (const f of files) {
    if (f.size > MAX_BYTES || !/\.pdf$/i.test(f.name)) {
      lines.push(t('bank.errFile', { name: f.name }));
      continue;
    }
    let text: string[];
    try {
      text = await pdfLines(new Uint8Array(await f.arrayBuffer()));
    } catch {
      lines.push(t('bank.errFile', { name: f.name }));
      continue;
    }
    const r = await importStatement(supabase, text, f.name, userId ?? null);
    if (!r.ok) {
      lines.push(t(`bank.err_${r.error}` as MessageKey, { name: f.name, msg: r.message ?? '' }));
      continue;
    }
    lines.push(t('bank.imported', { name: f.name, total: r.total, auto: r.auto, review: r.toReview }));
    await logAudit({
      entity_type: 'bank_statement',
      entity_id: r.statementId,
      action: 'create',
      changes: {},
      summary: `Выписка ${r.account} за ${r.period}: операций ${r.total}, сопоставлено сразу ${r.auto}`,
    });
  }
  refresh();
  return { ok: true, message: lines.join('\n') };
}

const errText = async (code: string, msg?: string) => {
  const { t } = await getT();
  return t(`bank.apply_${code}` as MessageKey, { msg: msg ?? '' });
};

/** Решение по одной операции. */
export async function decideTransaction(txId: string, decision: Decision): Promise<Result> {
  await requireCapability('bank.edit');
  const supabase = await createClient();
  const { userId } = await getSessionContext();
  const d: Decision =
    decision.type === 'trips'
      ? {
          type: 'trips',
          ids: [...new Set((decision.ids ?? []).map(String))].slice(0, 100),
          allocations: Array.isArray(decision.allocations)
            ? decision.allocations.slice(0, 100).map((a) => ({ tripId: String(a.tripId), amount: Number(a.amount) }))
            : undefined,
        }
      : decision.type === 'purchases'
      ? { type: decision.type, ids: [...new Set((decision.ids ?? []).map(String))].slice(0, 100) }
      : decision.type === 'overhead'
        ? { type: 'overhead', category: String(decision.category ?? '') }
        : decision.type === 'cash'
          ? { type: 'cash' }
          : { type: 'ignore' };
  const r = await applyDecision(supabase, txId, d, userId ?? null);
  if (!r.ok) return { ok: false, message: await errText(r.error, r.message) };
  await logAudit({
    entity_type: 'bank_transaction',
    entity_id: txId,
    action: 'update',
    changes: { decision: { before: 'new', after: d.type } },
    summary: `Операция выписки: ${d.type}${d.type === 'overhead' ? ` (${d.category})` : d.type === 'purchases' || d.type === 'trips' ? ` ×${d.ids.length}` : ''}`,
  });
  refresh();
  return { ok: true };
}

/** Принять все подсказки выписки (или всех выписок) разом. */
export async function acceptSuggestions(statementId: string | null): Promise<Result> {
  await requireCapability('bank.edit');
  const { t } = await getT();
  const supabase = await createClient();
  const { userId } = await getSessionContext();
  let q = supabase.from('bank_transactions').select('id, suggestion').eq('status', 'new').not('suggestion', 'is', null).limit(1000);
  if (statementId) q = q.eq('statement_id', statementId);
  const { data } = await q;
  let done = 0;
  let failed = 0;
  for (const r of (data ?? []) as { id: string; suggestion: any }[]) {
    const s = r.suggestion;
    const d: Decision | null =
      // Счета и заказы — только точные совпадения: «похоже на» решается вручную, с суммами.
      s?.type === 'purchases' || s?.type === 'trips'
        ? autoDecision(s)
        : s?.type === 'overhead' ? { type: 'overhead', category: s.category } : s?.type === 'cash' ? { type: 'cash' } : s?.type === 'ignore' ? { type: 'ignore' } : null;
    if (!d) continue;
    const res = await applyDecision(supabase, r.id, d, userId ?? null);
    if (res.ok) done++;
    else failed++;
  }
  if (done) {
    await logAudit({
      entity_type: 'bank_statement',
      entity_id: statementId ?? 'all',
      action: 'update',
      changes: { accepted: { before: null, after: done } },
      summary: `Выписка: приняты подсказки (${done})`,
    });
  }
  refresh();
  return { ok: true, message: t('bank.accepted', { n: done }) + (failed ? ' ' + t('bank.acceptFailed', { n: failed }) : '') };
}

/** Отменить решение по операции. */
export async function undoTransaction(txId: string): Promise<Result> {
  await requireCapability('bank.edit');
  const supabase = await createClient();
  const r = await undoDecision(supabase, txId);
  if (!r.ok) return { ok: false, message: await errText(r.error, r.message) };
  await logAudit({ entity_type: 'bank_transaction', entity_id: txId, action: 'update', changes: { decision: { before: 'decided', after: 'new' } }, summary: 'Операция выписки: решение отменено' });
  refresh();
  return { ok: true };
}

/** Удалить выписку: сначала отменяются все решения по её операциям. */
export async function deleteStatement(statementId: string): Promise<Result> {
  await requireCapability('bank.edit');
  const supabase = await createClient();
  const { data: txs } = await supabase.from('bank_transactions').select('id').eq('statement_id', statementId).neq('status', 'new');
  for (const r of (txs ?? []) as { id: string }[]) {
    const u = await undoDecision(supabase, r.id);
    if (!u.ok) return { ok: false, message: await errText(u.error, u.message) };
  }
  const { data: st } = await supabase.from('bank_statements').select('account, period_from, period_to').eq('id', statementId).maybeSingle();
  const { error } = await supabase.from('bank_statements').delete().eq('id', statementId);
  if (error) return { ok: false, message: await errText('db', error.message) };
  await logAudit({
    entity_type: 'bank_statement',
    entity_id: statementId,
    action: 'delete',
    changes: {},
    summary: `Выписка удалена: ${st?.account ?? ''} ${st?.period_from ?? ''} – ${st?.period_to ?? ''}`,
  });
  refresh();
  return { ok: true };
}

/** Пересчитать подсказки для операций без решения и применить однозначные. */
export async function rematchTransactions(): Promise<Result> {
  await requireCapability('bank.edit');
  const { t } = await getT();
  const supabase = await createClient();
  const { userId } = await getSessionContext();
  const r = await rematchPending(supabase, userId ?? null);
  if (r.auto) {
    await logAudit({ entity_type: 'bank_statement', entity_id: 'all', action: 'update', changes: { rematched: { before: null, after: r.auto } }, summary: `Выписка: подсказки пересчитаны, применено ${r.auto}` });
  }
  refresh();
  return { ok: true, message: t('bank.rematched', { checked: r.checked, auto: r.auto }) };
}
