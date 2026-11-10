'use server';

import { requireOffice } from '../../lib/require-office';
import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase/admin';

export async function deleteExpenseAction(id: string, tripId: string) {
  await requireOffice();
  const supabase = await createClient();
  const { error } = await supabase.from('trip_expenses').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/trips/${tripId}`);
}
