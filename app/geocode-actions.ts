'use server';

import { createClient } from '../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function addTripWithAddress(formData: FormData) {
  const supabase = await createClient();

  const clientId = formData.get('client_id') as string;
  const truckId = formData.get('truck_id') as string;
  const trailerId = formData.get('trailer_id') as string;
  const driverId = formData.get('driver_id') as string;
  const startDate = formData.get('start_date') as string;
  const revenueEur = parseFloat(formData.get('revenue_eur') as string) || 0;
  const manualFuel = parseFloat(formData.get('start_fuel_level') as string) || 0;

  const clientRequestNumber = formData.get('client_request_number') as string;
  const clientRequestDate = formData.get('client_request_date') as string;

  const senderCountry = formData.get('sender_country') as string;
  const senderName = formData.get('sender_name') as string;
  const senderPostalCode = formData.get('sender_postal_code') as string;
  const senderCity = formData.get('sender_city') as string;
  const senderAddress = formData.get('sender_address') as string;
  const senderLoadingNumber = formData.get('sender_loading_number') as string;

  const sender2Country = formData.get('sender2_country') as string;
  const sender2Name = formData.get('sender2_name') as string;
  const sender2PostalCode = formData.get('sender2_postal_code') as string;
  const sender2City = formData.get('sender2_city') as string;
  const sender2Address = formData.get('sender2_address') as string;
  const sender2LoadingNumber = formData.get('sender2_loading_number') as string;

  const sender3Country = formData.get('sender3_country') as string;
  const sender3Name = formData.get('sender3_name') as string;
  const sender3PostalCode = formData.get('sender3_postal_code') as string;
  const sender3City = formData.get('sender3_city') as string;
  const sender3Address = formData.get('sender3_address') as string;
  const sender3LoadingNumber = formData.get('sender3_loading_number') as string;

  const receiverCountry = formData.get('receiver_country') as string;
  const receiverName = formData.get('receiver_name') as string;
  const receiverPostalCode = formData.get('receiver_postal_code') as string;
  const receiverCity = formData.get('receiver_city') as string;
  const receiverAddress = formData.get('receiver_address') as string;
  const receiverLoadingNumber = formData.get('receiver_loading_number') as string;

  const route = `${senderCity || ''}, ${senderCountry || ''} → ${receiverCity || ''}, ${receiverCountry || ''}`;

  // ============================================================
  // 1. НОМЕР РЕЙСА — ищем НАИМЕНЬШИЙ СВОБОДНЫЙ номер
  // ============================================================
  const { data: existingTrips } = await supabase
    .from('trips')
    .select('trip_number')
    .not('trip_number', 'is', null);

  const usedNumbers = new Set<number>(
    (existingTrips || []).map((t) => t.trip_number).filter((n) => n !== null)
  );

  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) {
    nextNumber++;
  }

  // ============================================================
  // 2. ОСТАТОК ТОПЛИВА — берём из предыдущего рейса этой машины
  // ============================================================
  let startFuelLevel = manualFuel;

  if (truckId) {
    const { data: prevTrip } = await supabase
      .from('trips')
      .select('id, start_fuel_level, actual_liters, trip_number')
      .eq('truck_id', truckId)
      .order('trip_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (prevTrip) {
      const { data: fuelExpenses } = await supabase
        .from('trip_expenses')
        .select('liters')
        .eq('trip_id', prevTrip.id)
        .eq('category', 'fuel');

      const totalRefuel = fuelExpenses?.reduce((sum, e) => sum + (e.liters || 0), 0) || 0;
      const consumed = prevTrip.actual_liters || 0;
      const prevStart = prevTrip.start_fuel_level || 0;

      if (consumed > 0) {
        startFuelLevel = prevStart + totalRefuel - consumed;
      } else {
        startFuelLevel = prevStart + totalRefuel;
      }

      if (startFuelLevel < 0) startFuelLevel = 0;
    }
  }

  // ============================================================
  // 3. ГЕОКОДИРОВАНИЕ
  // ============================================================
  let startLat = 0;
  let startLng = 0;
  if (senderCity && senderCountry) {
    try {
      const query = encodeURIComponent(`${senderCity}, ${senderCountry}`);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
        { headers: { 'User-Agent': 'LogisticsCRM/1.0 (contact@raibuilding.pl)' } }
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          startLat = parseFloat(data[0].lat);
          startLng = parseFloat(data[0].lon);
        }
      }
    } catch (e) {
      console.error('Ошибка геокодирования:', e);
    }
  }

  // ============================================================
  // 4. СОЗДАЁМ РЕЙС
  // ============================================================
  const { error } = await supabase
    .from('trips')
    .insert([
      {
        client_id: clientId || null,
        truck_id: truckId || null,
        trailer_id: trailerId || null,
        driver_id: driverId || null,
        start_date: startDate,
        revenue_eur: revenueEur,
        start_fuel_level: startFuelLevel,
        client_request_number: clientRequestNumber || null,
        client_request_date: clientRequestDate || null,

        sender_country: senderCountry || null,
        sender_name: senderName || null,
        sender_postal_code: senderPostalCode || null,
        sender_city: senderCity || null,
        sender_address: senderAddress || null,
        sender_loading_number: senderLoadingNumber || null,

        sender2_country: sender2Country || null,
        sender2_name: sender2Name || null,
        sender2_postal_code: sender2PostalCode || null,
        sender2_city: sender2City || null,
        sender2_address: sender2Address || null,
        sender2_loading_number: sender2LoadingNumber || null,

        sender3_country: sender3Country || null,
        sender3_name: sender3Name || null,
        sender3_postal_code: sender3PostalCode || null,
        sender3_city: sender3City || null,
        sender3_address: sender3Address || null,
        sender3_loading_number: sender3LoadingNumber || null,

        receiver_country: receiverCountry || null,
        receiver_name: receiverName || null,
        receiver_postal_code: receiverPostalCode || null,
        receiver_city: receiverCity || null,
        receiver_address: receiverAddress || null,
        receiver_loading_number: receiverLoadingNumber || null,

        route: route || null,
        start_lat: startLat,
        start_lng: startLng,
        trip_number: nextNumber,
        status: 'planned',
      },
    ]);

  if (error) throw new Error(`Ошибка создания рейса: ${error.message}`);
  revalidatePath('/trips');
  redirect('/trips');
}
