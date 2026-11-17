'use server';

import { requireCapability } from '../lib/require-office';
import { createClient } from '../lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { classifyCapex } from '../lib/capex';
import { getT } from '../lib/i18n/server';
import { toEur } from '../lib/fx';
import { logAudit } from '../lib/audit';

const toEurForCost = (supabase: Awaited<ReturnType<typeof createClient>>, amount: number, currency: string, date: string) =>
  toEur(supabase, amount, currency, date);

type CostRow = { category: string | null; month_key: string | null; original_amount: number | null; currency: string | null; cost_type: string | null };
const costLine = (c: CostRow) => `${c.category ?? ''} · ${c.month_key ?? ''} · ${c.original_amount ?? ''} ${c.currency ?? ''}`;

/** Запись из счёта подрядчика или выписки правится там, откуда пришла, не здесь. */
async function fromInvoice(supabase: Awaited<ReturnType<typeof createClient>>, costId: string): Promise<boolean> {
  const first = await supabase.from('fixed_costs').select('purchase_invoice_id, bank_transaction_id').eq('id', costId).maybeSingle();
  // до миграции 040 колонки bank_transaction_id нет
  const { data, error } = first.error ? await supabase.from('fixed_costs').select('purchase_invoice_id').eq('id', costId).maybeSingle() : first;
  return !error && Boolean((data as any)?.purchase_invoice_id || (data as any)?.bank_transaction_id);
}

export async function createFixedCost(formData: FormData) {
  const { t } = await getT();
  await requireCapability('fixedCosts.edit');
  const supabase = await createClient();

  const monthKey = formData.get('month_key') as string;
  const category = formData.get('category') as string;
  const costType = formData.get('cost_type') as string;
  const expenseDate = formData.get('expense_date') as string;
  const originalAmount = parseFloat(formData.get('amount') as string) || 0;
  const currency = (formData.get('currency') as string) || 'EUR';

  // Если дата не указана — используем 1-е число месяца
  const dateForRate = expenseDate || `${monthKey}-01`;
  const amountEur = await toEurForCost(supabase, originalAmount, currency, dateForRate);

  // Инвестиция определяется автоматически по категории и сумме.
  const capex = classifyCapex(category, amountEur);

  const { data: created, error } = await supabase
    .from('fixed_costs')
    .insert([
      {
        month_key: monthKey,
        category: category,
        cost_type: costType,
        expense_date: expenseDate || null,
        currency: currency,
        original_amount: originalAmount,
        amount_eur: amountEur,
        amount_pln: currency === 'PLN' ? originalAmount : null,
        is_capex: capex.isCapex,
        capex_rule: capex.rule
      }
    ])
    .select('id')
    .single();

  if (error) throw new Error(t('dir.addError', { msg: error.message }));
  await logAudit({
    entity_type: 'fixed_cost',
    entity_id: created.id,
    action: 'create',
    changes: {},
    summary: `Общий расход: ${costLine({ category, month_key: monthKey, original_amount: originalAmount, currency, cost_type: costType })}`,
  });
  revalidatePath('/fixed-costs');
  redirect('/fixed-costs');
}

export async function updateFixedCost(costId: string, formData: FormData) {
  const { t } = await getT();
  await requireCapability('fixedCosts.edit');
  const supabase = await createClient();
  if (await fromInvoice(supabase, costId)) throw new Error(t('payx3.errFromInvoice'));

  const monthKey = formData.get('month_key') as string;
  const category = formData.get('category') as string;
  const costType = formData.get('cost_type') as string;
  const expenseDate = formData.get('expense_date') as string;
  const originalAmount = parseFloat(formData.get('amount') as string) || 0;
  const currency = (formData.get('currency') as string) || 'EUR';

  const dateForRate = expenseDate || `${monthKey}-01`;
  const amountEur = await toEurForCost(supabase, originalAmount, currency, dateForRate);

  // Инвестиция определяется автоматически по категории и сумме.
  const capex = classifyCapex(category, amountEur);

  const { data: before } = await supabase
    .from('fixed_costs')
    .select('category, month_key, original_amount, currency, cost_type')
    .eq('id', costId)
    .maybeSingle();

  const { error } = await supabase
    .from('fixed_costs')
    .update({
      month_key: monthKey,
      category: category,
      cost_type: costType,
      expense_date: expenseDate || null,
      currency: currency,
      is_capex: capex.isCapex,
      capex_rule: capex.rule,
      original_amount: originalAmount,
      amount_eur: amountEur,
      amount_pln: currency === 'PLN' ? originalAmount : null
    })
    .eq('id', costId);

  if (error) throw new Error(t('dir.updateError', { msg: error.message }));
  const after: CostRow = { category, month_key: monthKey, original_amount: originalAmount, currency, cost_type: costType };
  await logAudit({
    entity_type: 'fixed_cost',
    entity_id: costId,
    action: 'update',
    changes: { cost: { before: before ? costLine(before as CostRow) : null, after: costLine(after) } },
    summary: `Общий расход изменён: ${costLine(after)}`,
  });
  revalidatePath('/fixed-costs');
  redirect('/fixed-costs');
}

export async function deleteFixedCost(costId: string) {
  const { t } = await getT();
  await requireCapability('fixedCosts.edit');
  const supabase = await createClient();
  if (await fromInvoice(supabase, costId)) throw new Error(t('payx3.errFromInvoice'));

  const { data: before } = await supabase
    .from('fixed_costs')
    .select('category, month_key, original_amount, currency, cost_type')
    .eq('id', costId)
    .maybeSingle();
  const { error } = await supabase
    .from('fixed_costs')
    .delete()
    .eq('id', costId);
  if (error) throw new Error(t('dir.deleteError', { msg: error.message }));
  if (before) {
    await logAudit({
      entity_type: 'fixed_cost',
      entity_id: costId,
      action: 'delete',
      changes: { cost: { before: costLine(before as CostRow), after: null } },
      summary: `Общий расход удалён: ${costLine(before as CostRow)}`,
    });
  }
  revalidatePath('/fixed-costs');
}
