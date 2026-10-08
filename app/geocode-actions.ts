'use server';

import { createClient } from '../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logAudit } from '../lib/audit';

async function notifyDriverAboutNewTrip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  driverId: string,
  tripNumber: number,
  clientName: string,
  route: string,
  startDate: string,
  sender: { name: string | null; city: string | null; country: string | null },
  receiver: { name: string | null; city: string | null; country: string | null }
) {
  try {
    const { data: driver } = await supabase
      .from('drivers')
      .select('first_name, telegram_chat_id')
      .eq('id', driverId)
      .maybeSingle();

    if (!driver?.telegram_chat_id) return;

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    const senderLine = [sender.country, sender.city].filter(Boolean).join(', ') || '—';
    const receiverLine = [receiver.country, receiver.city].filter(Boolean).join(', ') || '—';

    const lines = [
      `🚛 *Новый рейс №${tripNumber}*`,
      '',
      `*Клиент:* ${clientName || '—'}`,
      `*Маршрут:* ${route || '—'}`,
      `*Дата старта:* ${startDate || 'уточняется'}`,
      '',
      `📍 *Загрузка:* ${sender.name || '—'}`,
      `   ${senderLine}`,
      '',
      `🏁 *Выгрузка:* ${receiver.name || '—'}`,
      `   ${receiverLine}`,
      '',
      `Подробности: https://logistics-new-ebon.vercel.app/driver`,
    ];

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: driver.telegram_chat_id,
        text: lines.join('\n'),
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[notifyDriver] send failed:', res.status, body);
    }
  } catch (e) {
    console.error('[notifyDriver] exception:', e);
  }
}

export async function addTripWithAddress(formData: FormData) {
  const supabase = await createClient();

  const clientId = formData.get('client_id') as string;
  const truckId = formData.get('truck_id') as string;
  const trailerId = formData.get('trailer_id') as string;
  const driverId = formData.get('driver_id') as string;
  const startDate = (formData.get('start_date') as string) || null;
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

  const sender4Country = formData.get('sender4_country') as string;
  const sender4Name = formData.get('sender4_name') as string;
  const sender4PostalCode = formData.get('sender4_postal_code') as string;
  const sender4City = formData.get('sender4_city') as string;
  const sender4Address = formData.get('sender4_address') as string;
  const sender4LoadingNumber = formData.get('sender4_loading_number') as string;

  const sender5Country = formData.get('sender5_country') as string;
  const sender5Name = formData.get('sender5_name') as string;
  const sender5PostalCode = formData.get('sender5_postal_code') as string;
  const sender5City = formData.get('sender5_city') as string;
  const sender5Address = formData.get('sender5_address') as string;
  const sender5LoadingNumber = formData.get('sender5_loading_number') as string;

  const receiverCountry = formData.get('receiver_country') as string;
  const receiverName = formData.get('receiver_name') as string;
  const receiverPostalCode = formData.get('receiver_postal_code') as string;
  const receiverCity = formData.get('receiver_city') as string;
  const receiverAddress = formData.get('receiver_address') as string;
  const receiverLoadingNumber = formData.get('receiver_loading_number') as string;

  const route = `${senderCity || ''}, ${senderCountry || ''} → ${receiverCity || ''}, ${receiverCountry || ''}`;

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

  async function geocode(city: string, country: string): Promise<{ lat: number; lng: number } | null> {
    if (!city || !country) return null;
    try {
      const query = encodeURIComponent(`${city}, ${country}`);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
        { headers: { 'User-Agent': 'LogisticsCRM/1.0 (contact@raibuilding.pl)' } }
      );
      if (!response.ok) return null;
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
    } catch (e) {
      console.error('Ошибка геокодирования:', e);
    }
    return null;
  }

  const senderCoords = await geocode(senderCity, senderCountry);
  const receiverCoords = await geocode(receiverCity, receiverCountry);

  const startLat = senderCoords?.lat ?? 0;
  const startLng = senderCoords?.lng ?? 0;
  const endLat = receiverCoords?.lat ?? 0;
  const endLng = receiverCoords?.lng ?? 0;

  let clientName = '';
  if (clientId) {
    const { data: cl } = await supabase
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .maybeSingle();
    clientName = cl?.name || '';
  }

  const { data: created, error } = await supabase
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

        sender4_country: sender4Country || null,
        sender4_name: sender4Name || null,
        sender4_postal_code: sender4PostalCode || null,
        sender4_city: sender4City || null,
        sender4_address: sender4Address || null,
        sender4_loading_number: sender4LoadingNumber || null,

        sender5_country: sender5Country || null,
        sender5_name: sender5Name || null,
        sender5_postal_code: sender5PostalCode || null,
        sender5_city: sender5City || null,
        sender5_address: sender5Address || null,
        sender5_loading_number: sender5LoadingNumber || null,

        receiver_country: receiverCountry || null,
        receiver_name: receiverName || null,
        receiver_postal_code: receiverPostalCode || null,
        receiver_city: receiverCity || null,
        receiver_address: receiverAddress || null,
        receiver_loading_number: receiverLoadingNumber || null,

        route: route || null,
        start_lat: startLat,
        start_lng: startLng,
        end_lat: endLat,
        end_lng: endLng,
        trip_number: nextNumber,
        status: 'planned',
      },
    ])
    .select('id')
    .single();

  if (error) throw new Error(`Ошибка создания рейса: ${error.message}`);

  if (created?.id) {
    await logAudit({
      entity_type: 'trip',
      entity_id: created.id,
      action: 'create',
      summary: `Создан рейс №${nextNumber}${clientName ? ' · ' + clientName : ''}${route ? ' · ' + route : ''}`,
    });
  }

  if (driverId) {
    await notifyDriverAboutNewTrip(
      supabase,
      driverId,
      nextNumber,
      clientName,
      route,
      startDate || '',
      { name: senderName, city: senderCity, country: senderCountry },
      { name: receiverName, city: receiverCity, country: receiverCountry }
    );
  }

  revalidatePath('/trips');
  redirect('/trips?toast=trip_created');
}
