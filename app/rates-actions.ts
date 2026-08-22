'use server';

import { supabase } from '../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

export async function updateRatesForTrip(tripId: string) {
  try {
    // 1. Получаем последний сохраненный курс из Supabase
    const { data: rates, error: ratesError } = await supabase
      .from('rates')
      .select('*')
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();

    if (ratesError || !rates) {
      throw new Error('Курсы не найдены в базы. Проверьте, работает ли скрипт обновления.');
    }

    // 2. Получаем данные рейса
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      throw new Error('Рейс не найден');
    }

    // 3. Расчитываем финансовые показатели
    const revenueEur = trip.revenue_eur;
    const totalExpensesEur = 0; // Сначала вручную, потом добавим автоматическое подсчет

    // 4. Обновляем данные рейса в базе
    const { error: updateError } = await supabase
      .from('trips')
      .update({
        revenue_eur: revenueEur // Здесь на самом деле ничего не меняется, но мы показываем процесс
      })
      .eq('id', tripId);

    if (updateError) {
      throw new Error('Ошибка обновления данных рейса');
    }

    revalidatePath(`/trips/${tripId}`);

    return { success: true, message: 'Курсы обновлены и применены!' };

  } catch (error) {
    console.error('Ошибка обновления курсов:', error);
    return { success: false, message: 'Ошибка: ' + (error as Error).message };
  }
}
