'use server';

import { supabase } from '../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

export async function addTripWithAddress(formData: FormData) {
  const clientId = formData.get('client_id') as string;
  const route = formData.get('route') as string;
  const startDate = formData.get('start_date') as string;
  const revenueEur = parseFloat(formData.get('revenue_eur') as string) || 0;
  const loadingAddress = formData.get('loading_address') as string;
  const warehouseName = formData.get('warehouse_name') as string;
  const startFuelLevel = parseFloat(formData.get('start_fuel_level') as string) || 0;

  let lat = 0;
  let lng = 0;
  if (loadingAddress) {
    const query = encodeURIComponent(loadingAddress);
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`);
    const data = await response.json();
    if (data && data.length > 0) {
      lat = parseFloat(data[0].lat);
      lng = parseFloat(data[0].lon);
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
        loading_address: loadingAddress,
        warehouse_name: warehouseName,
        start_lat: lat,
        start_lng: lng,
        start_fuel_level: startFuelLevel,
        status: 'planned'
      }
    ]);

  if (error) {
    throw new Error(`Ошибка создания рейса: ${error.message}`);
  }

  revalidatePath('/trips');
}
