'use server';

import { supabase } from '../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

// Функция для добавления расхода
export async function addExpense(formData: FormData) {
  const tripId = formData.get('trip_id') as string;
  const category = formData.get('category') as string;
  const amountEur = parseFloat(formData.get('amount_eur') as string) || 0;
  const description = formData.get('description') as string;
  const expenseDate = formData.get('expense_date') as string;

  const { error } = await supabase
    .from('trip_expenses')
    .insert([
      {
        trip_id: tripId,
        category: category,
        amount_eur: amountEur,
        description: description,
        expense_date: expenseDate || null
      }
    ]);

  if (error) throw new Error(`Ошибка добавления расхода: ${error.message}`);
  
  // Обновляем страницу, чтобы показать новый расход
  revalidatePath(`/trips/${tripId}`);
}