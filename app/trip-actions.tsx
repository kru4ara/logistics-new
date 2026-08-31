'use server';

import { supabase } from '../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

export async function addExpense(formData: FormData) {
  const tripId = formData.get('trip_id') as string;
  const category = formData.get('category') as string;
  const originalAmount = parseFloat(formData.get('amount') as string) || 0;
  const currency = formData.get('currency') as string;
  const liters = parseFloat(formData.get('liters') as string) || 0; // Добавили литры
  const description = formData.get('description') as string;
  const expenseDate = formData.get('expense_date') as string;

  let amountEur = originalAmount;
  if (currency === 'PLN') {
    const { data: rate } = await supabase
      .from('rates')
      .select('pln_to_eur')
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();
    if (rate?.pln_to_eur) amountEur = originalAmount * rate.pln_to_eur;
  } else if (currency === 'BYN') {
    const { data: rate } = await supabase
      .from('rates')
      .select('byn_to_eur')
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();
    if (rate?.byn_to_eur) amountEur = originalAmount * rate.byn_to_eur;
  }

  const { error } = await supabase
    .from('trip_expenses')
    .insert([
      {
        trip_id: tripId,
        category: category,
        amount_eur: amountEur,
        original_amount: originalAmount,
        currency: currency,
        liters: category === 'fuel' ? liters : null, // Сохраняем литры только для топлива
        description: description,
        expense_date: expenseDate || null
      }
    ]);

  if (error) throw new Error(`Ошибка добавления: ${error.message}`);
  revalidatePath(`/trips/${tripId}`);
}

export async function deleteExpense(expenseId: string, tripId: string) {
  const { error } = await supabase
    .from('trip_expenses')
    .delete()
    .eq('id', expenseId);
  if (error) throw new Error(`Ошибка удаления: ${error.message}`);
  revalidatePath(`/trips/${tripId}`);
}
