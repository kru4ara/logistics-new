'use server';

import { createClient } from '../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

async function convertToEur(
  supabase: Awaited<ReturnType<typeof createClient>>,
  amount: number,
  currency: string,
  dateStr: string
) {
  if (currency === 'EUR') return amount;

  if (currency === 'PLN') {
    const { data: rate } = await supabase
      .from('rates')
      .select('pln_to_eur')
      .lte('rate_date', dateStr)
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();
    return amount * (rate?.pln_to_eur ?? 0.23);
  }

  if (currency === 'BYN') {
    const { data: rate } = await supabase
      .from('rates')
      .select('byn_to_eur')
      .lte('rate_date', dateStr)
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();
    return amount * (rate?.byn_to_eur ?? 0.30);
  }

  return amount;
}

export async function createFixedCost(formData: FormData) {
  const supabase = await createClient();

  const monthKey = formData.get('month_key') as string;
  const category = formData.get('category') as string;
  const costType = formData.get('cost_type') as string;
  const expenseDate = formData.get('expense_date') as string;
  const originalAmount = parseFloat(formData.get('amount') as string) || 0;
  const currency = (formData.get('currency') as string) || 'EUR';

  // Если дата не указана — используем 1-е число месяца
  const dateForRate = expenseDate || `${monthKey}-01`;
  const amountEur = await convertToEur(supabase, originalAmount, currency, dateForRate);

  const { error } = await supabase
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
        amount_pln: currency === 'PLN' ? originalAmount : null
      }
    ]);

  if (error) throw new Error(`Ошибка добавления: ${error.message}`);
  revalidatePath('/fixed-costs');
  redirect('/fixed-costs');
}

export async function updateFixedCost(costId: string, formData: FormData) {
  const supabase = await createClient();

  const monthKey = formData.get('month_key') as string;
  const category = formData.get('category') as string;
  const costType = formData.get('cost_type') as string;
  const expenseDate = formData.get('expense_date') as string;
  const originalAmount = parseFloat(formData.get('amount') as string) || 0;
  const currency = (formData.get('currency') as string) || 'EUR';

  const dateForRate = expenseDate || `${monthKey}-01`;
  const amountEur = await convertToEur(supabase, originalAmount, currency, dateForRate);

  const { error } = await supabase
    .from('fixed_costs')
    .update({
      month_key: monthKey,
      category: category,
      cost_type: costType,
      expense_date: expenseDate || null,
      currency: currency,
      original_amount: originalAmount,
      amount_eur: amountEur,
      amount_pln: currency === 'PLN' ? originalAmount : null
    })
    .eq('id', costId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);
  revalidatePath('/fixed-costs');
  redirect('/fixed-costs');
}

export async function deleteFixedCost(costId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('fixed_costs')
    .delete()
    .eq('id', costId);
  if (error) throw new Error(`Ошибка удаления: ${error.message}`);
  revalidatePath('/fixed-costs');
}
