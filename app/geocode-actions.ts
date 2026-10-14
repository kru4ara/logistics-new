'use server';

import { createClient } from '../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logAudit } from '../lib/audit';
import { renumberAllTrips } from '../lib/trip-renumber';

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

  const receiverCountry = formData.get('receiver_country') as string;
  const receiverName = formData.get('receiver_name') as string;
  const receiverPostalCode = formData.get('receiver_postal_code') as string;
  const receiverCity = formData.get('receiver_city') as string;
  const receiverAddress = formData.get('receiver_address') as string;
  const receiverLoadingNumber = formData.get('receiver_loading_number') as string;

  const route = `${senderCity || ''}, ${senderCountry || ''} → ${receiverCity || ''}, ${receiverCountry || ''}`;

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

  // Временный номер 0 — после insert перенумеруем всё
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
        trip_number: 0, // временно, будет пересчитан ниже
        status: 'planned',
      },
    ])
    .select('id')
    .single();

  if (error || !created) throw new Error(`Ошибка создания рейса: ${error?.message || 'unknown'}`);

  // ============================================================
  // Автосоздание us-сегмента + «Основного груза» для нового рейса
  // ============================================================
  try {
    const { data: segment, error: segErr } = await supabase
      .from('trip_segments')
      .insert([{
        trip_id: created.id,
        position: 1,
        executor_type: 'us',
        truck_id: truckId || null,
        driver_id: driverId || null,
        date_from: startDate || null,
        date_to: null,
        from_country: senderCountry || null,
        from_city: senderCity || null,
        from_company: senderName || null,
        from_address: senderAddress || null,
        from_postal_code: senderPostalCode || null,
        to_country: receiverCountry || null,
        to_city: receiverCity || null,
        to_company: receiverName || null,
        to_address: receiverAddress || null,
        to_postal_code: receiverPostalCode || null,
        stops: [],
        notes: null,
        price: null,
        currency: null,
      }])
      .select('id')
      .single();

    if (segErr || !segment) {
      console.error('[addTrip] segment insert failed:', segErr?.message);
    } else {
      const { data: cargo, error: cargoErr } = await supabase
        .from('trip_cargo')
        .insert([{
          trip_id: created.id,
          position: 1,
          label: 'Основной груз',
          cargo_type: null,
          weight_kg: null,
          client_id: clientId || null,
          notes: 'Автосоздано при создании рейса',
          from_country: senderCountry || null,
          from_city: senderCity || null,
          from_company: senderName || null,
          from_address: senderAddress || null,
          from_postal_code: senderPostalCode || null,
          to_country: receiverCountry || null,
          to_city: receiverCity || null,
          to_company: receiverName || null,
          to_address: receiverAddress || null,
          to_postal_code: receiverPostalCode || null,
        }])
        .select('id')
        .single();

      if (cargoErr || !cargo) {
        console.error('[addTrip] cargo insert failed:', cargoErr?.message);
      } else {
        const { error: linkErr } = await supabase
          .from('trip_segment_cargo')
          .insert([{ segment_id: segment.id, cargo_id: cargo.id }]);
        if (linkErr) {
          console.error('[addTrip] segment_cargo link failed:', linkErr.message);
        }
      }
    }
  } catch (e) {
    console.error('[addTrip] auto-segment exception:', e);
  }

  // Перенумерация всех рейсов по start_date ASC
  await renumberAllTrips(supabase);

  // Получаем финальный номер
  const { data: finalTrip } = await supabase
    .from('trips')
    .select('trip_number')
    .eq('id', created.id)
    .single();

  const finalNumber = finalTrip?.trip_number ?? 0;

  await logAudit({
    entity_type: 'trip',
    entity_id: created.id,
    action: 'create',
    summary: `Создан рейс №${finalNumber}${clientName ? ' · ' + clientName : ''}${route ? ' · ' + route : ''}`,
  });

  if (driverId) {
    await notifyDriverAboutNewTrip(
      supabase,
      driverId,
      finalNumber,
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
