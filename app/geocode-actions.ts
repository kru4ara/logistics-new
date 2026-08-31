'use server';

import { supabase } from '../lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function addTripWithAddress(formData: FormData) {
  const clientId = formData.get('client_id') as string;
  const route = formData.get('route') as string;
  const startDate = formData.get('start_date') as string;
  const revenueEur = parseFloat(formData.get('revenue_eur') as string) || 0;
  const startFuelLevel = parseFloat(formData.get('start_fuel_level') as string) || 0;

  // 1. Получаем текущий счётчик (maybeSingle, чтобы не падать, если строки нет)
  const { data: counterData, error: counterError } = await supabase
    .from('trip_counter')
    .select('last_number')
    .eq('id', 1)
    .maybeSingle();

  if (counterError) {
    throw new Error(`Ошибка счётчика: ${counterError.message}`);
  }

  // 2. Если строки нет — создаём её
  let currentNumber = counterData?.last_number ?? 0;
  if (!counterData) {
    const { error: insertCounterError } = await supabase
      .from('trip_counter')
      .insert({ id: 1, last_number: 0 });
    if (insertCounterError) {
      throw new Error(`Ошибка создания счётчика: ${insertCounterError.message}`);
    }
  }

  // 3. Увеличиваем счётчик
  const nextNumber = currentNumber + 1;
  const { error: updateCounterError } = await supabase
    .from('trip_counter')
    .update({ last_number: nextNumber })
    .eq('id', 1);
  if (updateCounterError) {
    throw new Error(`Ошибка обновления счётчика: ${updateCounterError.message}`);
  }

  // 4. Создаём рейс с новым номером
  const { error } = await supabase
    .from('trips')
    .insert([
      {
        client_id: clientId || null,
        route: route,
        start_date: startDate,
        revenue_eur: revenueEur,
        start_fuel_level: startFuelLevel,
        trip_number: nextNumber,
        status: 'planned'
      }
    ]);

  if (error) {
    throw new Error(`Ошибка создания рейса: ${error.message}`);
  }

  revalidatePath('/trips');
  redirect('/trips');
}
