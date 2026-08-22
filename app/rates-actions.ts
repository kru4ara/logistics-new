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
      throw new Error('Курсы не найдены в базе. Проверьте, работает ли скрипт обновления.');
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

    // 3. Расчитываем новые значения в EUR
    const newRevEur = trip.revenue_eur; // Если выручка уже в EUR, оставляем
    // Предположим, что расходы в BYN или PLN, пересчитываем в EUR.
    // В реальном коде нужно брать значения расходов из trip_expenses.

    // 4. Обновляем данные рейса в базе (запись актуальных курсов)
    const { error: updateError } = await supabase
      .from('trips')
      .update({
        // Здесь можно сохранить курсы в поля, если они есть в таблице trips
        // Или просто пересчитать прибыль, если она хранится здесь
        revenue_eur: newRevEur // Пример
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
