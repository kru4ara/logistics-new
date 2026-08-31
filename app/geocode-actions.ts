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

  const { error } = await supabase
    .from('trips')
    .insert([
      {
        client_id: clientId || null,
        route: route,
        start_date: startDate,
        revenue_eur: revenueEur,
        start_fuel_level: startFuelLevel, // ← добавляем остаток
        status: 'planned'
      }
    ]);

  if (error) {
    throw new Error(`Ошибка создания рейса: ${error.message}`);
  }

  revalidatePath('/trips');
  redirect('/trips');
}
