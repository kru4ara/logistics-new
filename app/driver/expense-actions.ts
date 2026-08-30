'use server';

import { supabase } from '../../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

export async function addDriverExpense(formData: FormData) {
  const tripId = formData.get('trip_id') as string;
  const category = formData.get('category') as string;
  const amount = parseFloat(formData.get('amount') as string) || 0;
  const currency = formData.get('currency') as string;
  const description = formData.get('description') as string;
  const expenseDate = formData.get('expense_date') as string;

  // Если валюта не EUR, пересчитываем в EUR по текущему курсу
  let amountEur = amount;
  if (currency === 'PLN') {
    const { data: rate } = await supabase
      .from('rates')
      .select('pln_to_eur')
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();

    if (rate?.pln_to_eur) {
      amountEur = amount * rate.pln_to_eur;
    }
  } else if (currency === 'BYN') {
    const { data: rate } = await supabase
      .from('rates')
      .select('byn_to_eur')
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();

    if (rate?.byn_to_eur) {
      amountEur = amount * rate.byn_to_eur;
    }
  }

  const { error } = await supabase
    .from('trip_expenses')
    .insert([
      {
        trip_id: tripId,
        category: category,
        amount_eur: amountEur,
        original_amount: amount,
        currency: currency,
        description: description,
        expense_date: expenseDate || null
      }
    ]);

  if (error) {
    throw new Error(`Ошибка добавления: ${error.message}`);
  }

  revalidatePath(`/driver/trips/${tripId}`);
}
