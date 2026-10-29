'use server';

import { createClient } from '../../lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requireTripAccess } from '../../lib/driver-access';

export async function addDriverExpense(formData: FormData) {
  const tripId = formData.get('trip_id') as string;

  // trip_id приходит от клиента — проверяем, что рейс принадлежит водителю.
  const access = await requireTripAccess(tripId);
  if (!access.ok) {
    return { success: false, error: access.reason };
  }

  const supabase = await createClient();
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
