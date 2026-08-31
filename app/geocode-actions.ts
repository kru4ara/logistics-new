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

  // 1. Получаем все существующие номера рейсов
  const { data: existingTrips, error: fetchError } = await supabase
    .from('trips')
    .select('trip_number');

  if (fetchError) {
    console.error('Ошибка получения номеров:', fetchError.message);
    throw new Error(`Ошибка получения номеров: ${fetchError.message}`);
  }

  const existingNumbers = new Set<number>(
    existingTrips?.map(t => t.trip_number).filter((n): n is number => n != null) || []
  );

  // 2. Находим минимальный свободный номер, начиная с 1
  let nextNumber = 1;
  while (existingNumbers.has(nextNumber)) {
    nextNumber++;
  }

  // 3. Вставляем рейс с найденным номером
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
    console.error('Ошибка создания рейса:', error.message);
    throw new Error(`Ошибка создания рейса: ${error.message}`);
  }

  revalidatePath('/trips');
  redirect('/trips');
}
