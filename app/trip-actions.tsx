'use server';

import { supabase } from '../lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Добавление расхода (уже есть)
export async function addExpense(formData: FormData) {
  const tripId = formData.get('trip_id') as string;
  const category = formData.get('category') as string;
  const originalAmount = parseFloat(formData.get('amount') as string) || 0;
  const currency = formData.get('currency') as string;
  const liters = parseFloat(formData.get('liters') as string) || 0;
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
        liters: category === 'fuel' ? liters : null,
        description: description,
        expense_date: expenseDate || null
      }
    ]);

  if (error) throw new Error(`Ошибка добавления: ${error.message}`);
  revalidatePath(`/trips/${tripId}`);
}

// Удаление расхода (уже есть)
export async function deleteExpense(expenseId: string, tripId: string) {
  const { error } = await supabase
    .from('trip_expenses')
    .delete()
    .eq('id', expenseId);
  if (error) throw new Error(`Ошибка удаления: ${error.message}`);
  revalidatePath(`/trips/${tripId}`);
}

// НОВОЕ: Редактирование рейса
export async function updateTrip(tripId: string, formData: FormData) {
  const clientId = formData.get('client_id') as string;
  const route = formData.get('route') as string;
  const startDate = formData.get('start_date') as string;
  const revenueEur = parseFloat(formData.get('revenue_eur') as string) || 0;

  const { error } = await supabase
    .from('trips')
    .update({
      client_id: clientId || null,
      route: route,
      start_date: startDate,
      revenue_eur: revenueEur
    })
    .eq('id', tripId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

// НОВОЕ: Удаление рейса
export async function deleteTrip(tripId: string) {
  // Удаляем связанные расходы, если есть (чтобы не нарушить целостность)
  const { error: expensesError } = await supabase
    .from('trip_expenses')
    .delete()
    .eq('trip_id', tripId);
  if (expensesError) throw new Error(`Ошибка удаления расходов: ${expensesError.message}`);

  // Удаляем связанные документы
  const { error: docsError } = await supabase
    .from('trip_documents')
    .delete()
    .eq('trip_id', tripId);
  if (docsError) throw new Error(`Ошибка удаления документов: ${docsError.message}`);

  // Удаляем сам рейс
  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', tripId);
  if (error) throw new Error(`Ошибка удаления рейса: ${error.message}`);

  revalidatePath('/trips');
  redirect('/trips');
}
