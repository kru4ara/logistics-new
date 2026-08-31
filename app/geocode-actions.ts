'use server';

import { supabase } from '../lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function addTripWithAddress(formData: FormData) {
  const clientId = formData.get('client_id') as string;
  const route = formData.get('route') as string;
  const startDate = formData.get('start_date') as string;
  const revenueEur = parseFloat(formData.get('revenue_eur') as string) || 0;
  const truckId = formData.get('truck_id') as string;

  // Автоматически рассчитываем остаток топлива от предыдущего рейса этой машины
  let startFuelLevel = 0;
  if (truckId) {
    // Находим последний рейс для этого грузовика
    const { data: prevTrip } = await supabase
      .from('trips')
      .select('id, start_fuel_level, actual_liters')
      .eq('truck_id', truckId)
      .order('trip_number', { ascending: false })
      .limit(1)
      .single();

    if (prevTrip) {
      // Считаем все заправки этого рейса (литры в расходах с категорией "fuel")
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
        status: 'planned'
      }
    ]);

  if (error) {
    throw new Error(`Ошибка создания рейса: ${error.message}`);
  }

  revalidatePath('/trips');
  redirect('/trips');
}
