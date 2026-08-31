'use server';

import { supabase } from '../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

export async function addExpense(formData: FormData) {
  const tripId = formData.get('trip_id') as string;
  const category = formData.get('category') as string;
  const originalAmount = parseFloat(formData.get('amount') as string) || 0;
  const currency = formData.get('currency') as string;
  const liters = parseFloat(formData.get('liters') as string) || 0;
  const description = formData.get('description') as string;
  const expenseDate = formData.get('expense_date') as string;

  let amountEur = originalAmount;
  let rateUsed = null;

  // Функция для получения курса на дату (или ближайший доступный до неё)
  async function getRateOnDate(rateColumn: string) {
    if (expenseDate) {
      // Ищем курс с датой <= дата расхода
      const { data } = await supabase
        .from('rates')
        .select(rateColumn)
        .lte('rate_date', expenseDate)
        .order('rate_date', { ascending: false })
        .limit(1)
        .single();

      if (data && data[rateColumn]) return data[rateColumn];
    }

    // Если нет точной даты, берём последний известный курс
    const { data: latest } = await supabase
      .from('rates')
      .select(rateColumn)
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();

    if (latest && latest[rateColumn]) return latest[rateColumn];

    // Если вообще нет данных — возвращаем null (используем запасные значения)
    return null;
  }

  if (currency === 'PLN') {
    const rate = await getRateOnDate('pln_to_eur');
    rateUsed = rate;
    amountEur = originalAmount * (rate ?? 0.23); // 0.23 — запасной курс
  } else if (currency === 'BYN') {
    const rate = await getRateOnDate('byn_to_eur');
    rateUsed = rate;
    amountEur = originalAmount * (rate ?? 0.30); // 0.30 — запасной курс
  }

  // Если курс не найден и мы использовали запасной — можно вывести предупреждение (опционально)
  // console.log('Курс не найден, использован запасной');

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

export async function deleteExpense(expenseId: string, tripId: string) {
  const { error } = await supabase
    .from('trip_expenses')
    .delete()
    .eq('id', expenseId);
  if (error) throw new Error(`Ошибка удаления: ${error.message}`);
  revalidatePath(`/trips/${tripId}`);
}
