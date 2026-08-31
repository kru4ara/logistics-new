'use server';

import { supabase } from '../lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Функция для нахождения минимального свободного номера
async function getNextTripNumber(): Promise<number> {
  // Загружаем все номера рейсов из таблицы
  const { data: trips } = await supabase
    .from('trips')
    .select('trip_number')
    .order('trip_number', { ascending: true });

  const existingNumbers = new Set<number>();
  trips?.forEach((t) => {
    if (t.trip_number) existingNumbers.add(t.trip_number);
  });

  // Ищем первый пропуск в последовательности
  let candidate = 1;
  while (existingNumbers.has(candidate)) {
    candidate++;
  }

  return candidate;
}

export async function addTripWithAddress(formData: FormData) {
  const clientId = formData.get('client_id') as string;
  const route = formData.get('route') as string;
  const startDate = formData.get('start_date') as string;
  const revenueEur = parseFloat(formData.get('revenue_eur') as string) || 0;
  const truckId = formData.get('truck_id') as string;
  const manualStartFuel = parseFloat(formData.get('start_fuel_level') as string) || 0;
  let startFuelLevel = manualStartFuel;

  // 1. Получаем следующий свободный номер
  const tripNumber = await getNextTripNumber();

  // 2. Расчёт остатка топлива (если есть предыдущий рейс этой машины)
  if (truckId) {
    const { data: prevTrip } = await supabase
      .from('trips')
      .select('id, start_fuel_level, actual_liters')
      .eq('truck_id', truckId)
      .order('trip_number', { ascending: false })
      .limit(1)
      .single();

    if (prevTrip) {
      const { data: fuelExpenses } = await supabase
        .from('trip_expenses')
        .select('liters')
        .eq('trip_id', prevTrip.id)
        .eq('category', 'fuel');
      const totalRefuel = fuelExpenses?.reduce((sum, e) => sum + (e.liters || 0), 0) || 0;
      const consumed = prevTrip.actual_liters || 0;
      startFuelLevel = (prevTrip.start_fuel_level || 0) + totalRefuel - consumed;
    }
  }

  // 3. Вставляем рейс с этим номером
  const { error } = await supabase
    .from('trips')
    .insert([
      {
        client_id: clientId || null,
        route: route,
        start_date: startDate,
        revenue_eur: revenueEur,
        truck_id: truckId || null,
        start_fuel_level: startFuelLevel,
        trip_number: tripNumber,
        status: 'planned'
      }
    ]);

  if (error) throw new Error(`Ошибка создания рейса: ${error.message}`);
  revalidatePath('/trips');
  redirect('/trips');
}
