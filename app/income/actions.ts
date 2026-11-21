'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '../../lib/require-office';
import { createClient } from '../../lib/supabase/admin';
import { getSessionContext } from '../../lib/session';
import { getT } from '../../lib/i18n/server';
import { toEur } from '../../lib/fx';
import { isMonthClosed } from '../../lib/closed-months';
import { logAudit } from '../../lib/audit';
import { isIncomeCategory } from '../../lib/other-income';

type Result = { ok: boolean; message?: string };
const CURRENCIES = new Set(['EUR', 'PLN', 'BYN', 'USD']);

/** Прочий доход вручную (наличными, по договору — без операции в выписке). */
export async function addOtherIncome(fd: FormData): Promise<Result> {
  await requireCapability('fixedCosts.edit');
  const { t } = await getT();
  const date = String(fd.get('income_date') ?? '').slice(0, 10);
  const amount = Math.round(Number(String(fd.get('amount') ?? '').replace(',', '.')) * 100) / 100;
  const currency = String(fd.get('currency') ?? 'EUR').toUpperCase();
  const category = String(fd.get('category') ?? '');
  const description = String(fd.get('description') ?? '').trim().slice(0, 300) || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: t('income.errDate') };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: t('income.errAmount') };
  if (!isIncomeCategory(category) || !CURRENCIES.has(currency)) return { ok: false, message: t('income.errAmount') };
  const supabase = await createClient();
  if (await isMonthClosed(supabase, date.slice(0, 7))) return { ok: false, message: t('income.errClosed') };
  const { userId } = await getSessionContext();
  const { data, error } = await supabase
    .from('other_income')
    .insert({
      income_date: date,
      month_key: date.slice(0, 7),
      category,
      description,
      original_amount: amount,
      currency,
      amount_eur: await toEur(supabase, amount, currency, date),
      created_by: userId ?? null,
    })
    .select('id')
    .single();
  if (error) return { ok: false, message: error.message };
  await logAudit({
    entity_type: 'other_income',
    entity_id: data.id,
    action: 'create',
    summary: `Прочий доход: ${amount} ${currency} · ${category}${description ? ` · ${description}` : ''}`,
  });
  revalidatePath('/income');
  return { ok: true };
}

/** Удалить ручной прочий доход. Из выписки — только отменой решения в «Банке». */
export async function deleteOtherIncome(id: string): Promise<Result> {
  await requireCapability('fixedCosts.edit');
  const { t } = await getT();
  const supabase = await createClient();
  const { data: row } = await supabase.from('other_income').select('id, month_key, original_amount, currency, category, bank_transaction_id').eq('id', id).maybeSingle();
  if (!row) return { ok: true };
  if (row.bank_transaction_id) return { ok: false, message: t('income.bankUndo') };
  if (await isMonthClosed(supabase, row.month_key as string)) return { ok: false, message: t('income.errClosed') };
  const { error } = await supabase.from('other_income').delete().eq('id', id).is('bank_transaction_id', null);
  if (error) return { ok: false, message: error.message };
  await logAudit({
    entity_type: 'other_income',
    entity_id: id,
    action: 'delete',
    summary: `Удалён прочий доход: ${row.original_amount} ${row.currency} · ${row.category}`,
  });
  revalidatePath('/income');
  return { ok: true };
}
