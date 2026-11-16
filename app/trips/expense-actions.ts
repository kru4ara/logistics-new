'use server';

import { requireOffice } from '../../lib/require-office';
import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase/admin';

export async function deleteExpenseAction(id: string, tripId: string) {
  await requireOffice();
  const supabase = await createClient();
  // Расход из счёта подрядчика: счёт возвращается в «требуют привязки», а не висит на рейсе.
  const { data: row, error: readErr } = await supabase.from('trip_expenses').select('purchase_invoice_id').eq('id', id).maybeSingle();
  const invoiceId = readErr ? null : ((row?.purchase_invoice_id as string | null) ?? null);
  const { error } = await supabase.from('trip_expenses').delete().eq('id', id);
  if (error) throw new Error(error.message);
  if (invoiceId) {
    await supabase
      .from('purchase_invoices')
      .update({ trip_id: null, match_status: 'none', updated_at: new Date().toISOString() })
      .eq('id', invoiceId);
    revalidatePath('/payables');
  }
  revalidatePath(`/trips/${tripId}`);
}
