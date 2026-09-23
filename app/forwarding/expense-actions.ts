'use server';

import { createClient } from '../../lib/supabase-server';
import { revalidatePath } from 'next/cache';

// ============================================================
// Добавление расхода
// ============================================================
export async function addForwardingExpense(formData: FormData) {
  const supabase = await createClient();

  const forwardingId = formData.get('forwarding_id') as string;
  const category = formData.get('category') as string;
  const originalAmount = parseFloat(formData.get('amount') as string) || 0;
  const currency = formData.get('currency') as string;
  const description = formData.get('description') as string;
  const expenseDate = formData.get('expense_date') as string;

  const dateForRate = expenseDate || new Date().toISOString().split('T')[0];
  let amountEur = originalAmount;

  if (currency === 'PLN') {
    const { data: rate } = await supabase
      .from('rates')
      .select('pln_to_eur')
      .lte('rate_date', dateForRate)
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();
    amountEur = originalAmount * (rate?.pln_to_eur ?? 0.23);
  } else if (currency === 'BYN') {
    const { data: rate } = await supabase
      .from('rates')
      .select('byn_to_eur')
      .lte('rate_date', dateForRate)
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();
    amountEur = originalAmount * (rate?.byn_to_eur ?? 0.30);
  }

  const { error } = await supabase
    .from('forwarding_expenses')
    .insert([
      {
        forwarding_id: forwardingId,
        category,
        amount_eur: amountEur,
        original_amount: originalAmount,
        currency,
        description: description || null,
        expense_date: expenseDate || null,
      },
    ]);

  if (error) throw new Error(`Ошибка добавления: ${error.message}`);

  revalidatePath(`/forwarding/${forwardingId}`);
  revalidatePath('/forwarding');
  revalidatePath('/statistics');
  revalidatePath('/');
}

// ============================================================
// Удаление расхода
// ============================================================
export async function deleteForwardingExpense(expenseId: string, forwardingId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('forwarding_expenses')
    .delete()
    .eq('id', expenseId);

  if (error) throw new Error(`Ошибка удаления: ${error.message}`);

  revalidatePath(`/forwarding/${forwardingId}`);
  revalidatePath('/forwarding');
  revalidatePath('/statistics');
  revalidatePath('/');
}
