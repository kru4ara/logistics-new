'use server';

import { supabase } from '../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

export async function deleteExpense(expenseId: string, tripId: string) {
  const { error } = await supabase
    .from('trip_expenses')
    .eq('id', expenseId)
    .delete();

  if (error) {
    throw new Error(`Ошибка удаления: ${error.message}`);
  }

  revalidatePath(`/trips/${tripId}`);
}
