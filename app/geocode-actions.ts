'use server';

import { createClient } from '../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logAudit } from '../lib/audit';
import { geocode } from '../lib/geocode';

// ============================================================
// Конвертация в EUR по курсу на дату (EUR / PLN / BYN)
// ============================================================
async function toEur(
  supabase: Awaited<ReturnType<typeof createClient>>,
  amount: number,
  currency: string,
  date: string
): Promise<number> {
  if (!amount || amount <= 0) return 0;
  const cur = (currency || 'EUR').toUpperCase();
  if (cur === 'EUR') return amount;

  if (cur === 'PLN') {
    const { data: rate } = await supabase
      .from('rates')
      .select('pln_to_eur')
      .lte('rate_date', date)
      .order('rate_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    return amount * (rate?.pln_to_eur ?? 0.23);
  }

  if (cur === 'BYN') {
    const { data: rate } = await supabase
      .from('rates')
      .select('byn_to_eur')
      .lte('rate_date', date)
      .order('rate_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    return amount * (rate?.byn_to_eur ?? 0.30);
  }

  return amount;
}

// ============================================================
// Уведомление водителя в Telegram (используется сегментами)
// ============================================================
export async function notifyDriverAboutNewTrip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  driverId: string,
  tripNumber: number,
  clientName: string,
  route: string,
  startDate: string,
  from: { name: string | null; city: string | null; country: string | null },
  to: { name: string | null; city: string | null; country: string | null }
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

    const fromLine = [from.country, from.city].filter(Boolean).join(', ') || '—';
    const toLine = [to.country, to.city].filter(Boolean).join(', ') || '—';

    const lines = [
      `🚛 *Новый рейс №${tripNumber}*`,
      '',
      `*Клиент:* ${clientName || '—'}`,
      `*Маршрут:* ${route || '—'}`,
      `*Дата старта:* ${startDate || 'уточняется'}`,
      '',
      `📍 *Загрузка:* ${from.name || '—'}`,
      `   ${fromLine}`,
      '',
      `🏁 *Выгрузка:* ${to.name || '—'}`,
      `   ${toLine}`,
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

// ============================================================
// НОВОЕ: создание заявки/груза (рейс-обёртка + первый груз)
// Сегмент НЕ создаётся — появится, когда найден транспорт.
// ============================================================
export async function createCargoWithTrip(formData: FormData) {
  const supabase = await createClient();

  // ---- Клиент и заявка ----
  const clientId = ((formData.get('client_id') as string) || '').trim() || null;
  const clientRequestNumber = ((formData.get('client_request_number') as string) || '').trim() || null;
  const clientRequestDate = ((formData.get('client_request_date') as string) || '').trim() || null;
  const dateForRate = clientRequestDate || new Date().toISOString().slice(0, 10);

  // ---- Маршрут: откуда ----
  const fromCountry = ((formData.get('from_country') as string) || '').trim() || null;
  const fromName = ((formData.get('from_name') as string) || '').trim() || null;
  const fromPostalCode = ((formData.get('from_postal_code') as string) || '').trim() || null;
  const fromCity = ((formData.get('from_city') as string) || '').trim() || null;
  const fromAddress = ((formData.get('from_address') as string) || '').trim() || null;
  const fromLoadingNumber = ((formData.get('from_loading_number') as string) || '').trim() || null;

  // ---- Маршрут: куда ----
  const toCountry = ((formData.get('to_country') as string) || '').trim() || null;
  const toName = ((formData.get('to_name') as string) || '').trim() || null;
  const toPostalCode = ((formData.get('to_postal_code') as string) || '').trim() || null;
  const toCity = ((formData.get('to_city') as string) || '').trim() || null;
  const toAddress = ((formData.get('to_address') as string) || '').trim() || null;
  const toLoadingNumber = ((formData.get('to_loading_number') as string) || '').trim() || null;

  // ---- Таможня (промежуточная точка) ----
  const customsPlace = ((formData.get('customs_place') as string) || '').trim() || null;
  const customsCountry = ((formData.get('customs_country') as string) || '').trim() || null;
  const customsCity = ((formData.get('customs_city') as string) || '').trim() || null;
  const customsPostalCode = ((formData.get('customs_postal_code') as string) || '').trim() || null;
  const customsAddress = ((formData.get('customs_address') as string) || '').trim() || null;

  // ---- Груз ----
  const label = ((formData.get('label') as string) || '').trim();
  const cargoType = ((formData.get('cargo_type') as string) || '').trim() || null;
  const weightRaw = (formData.get('weight_kg') as string) || '';
  const weightKg = weightRaw ? parseFloat(weightRaw) : null;
  const palletsRaw = (formData.get('pallets') as string) || '';
  const pallets = palletsRaw ? parseInt(palletsRaw, 10) : null;
  const notes = ((formData.get('notes') as string) || '').trim() || null;

  // ---- Фрахт ----
  const freightRaw = (formData.get('freight_amount') as string) || '';
  const freightAmount = freightRaw ? parseFloat(freightRaw) : 0;
  const freightCurrency = (((formData.get('freight_currency') as string) || 'EUR').toUpperCase()) || 'EUR';

  if (!label) throw new Error('Укажите название груза');

  // ---- Геокодинг ----
  const fromCoords = await geocode(fromCity, fromCountry, fromPostalCode);
  const toCoords = await geocode(toCity, toCountry, toPostalCode);
  const customsCoords = customsCity || customsCountry
    ? await geocode(customsCity, customsCountry, customsPostalCode)
    : null;

  const startLat = fromCoords?.lat ?? 0;
  const startLng = fromCoords?.lng ?? 0;
  const endLat = toCoords?.lat ?? 0;
  const endLng = toCoords?.lng ?? 0;

  // ---- Фрахт в EUR (для отчётов) ----
  const revenueEur = await toEur(supabase, freightAmount, freightCurrency, dateForRate);

  // ---- Имя клиента (для audit / уведомлений) ----
  let clientName = '';
  if (clientId) {
    const { data: cl } = await supabase
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .maybeSingle();
    clientName = cl?.name || '';
  }

  // ---- 1. Рейс-обёртка ----
  const { data: created, error } = await supabase
    .from('trips')
    .insert([
      {
        client_id: clientId,
        truck_id: null,
        trailer_id: null,
        driver_id: null,
        start_date: null,
        revenue_eur: revenueEur,
        start_fuel_level: 0,
        client_request_number: clientRequestNumber,
        client_request_date: clientRequestDate,
        start_lat: startLat,
        start_lng: startLng,
        end_lat: endLat,
        end_lng: endLng,
        trip_number: 0, // триггер set_trip_number поставит MAX+1
        status: 'planned',
      },
    ])
    .select('id, trip_number')
    .single();

  if (error || !created) throw new Error(`Ошибка создания заявки: ${error?.message || 'unknown'}`);

  // ---- 2. Первый груз ----
  const { data: cargo, error: cargoErr } = await supabase
    .from('trip_cargo')
    .insert([
      {
        trip_id: created.id,
        position: 1,
        label,
        cargo_type: cargoType,
        weight_kg: weightKg,
        pallets,
        client_id: clientId,
        notes,
        from_country: fromCountry,
        from_city: fromCity,
        from_company: fromName,
        from_address: fromAddress,
        from_postal_code: fromPostalCode,
        to_country: toCountry,
        to_city: toCity,
        to_company: toName,
        to_address: toAddress,
        to_postal_code: toPostalCode,
        customs_place: customsPlace,
        customs_country: customsCountry,
        customs_city: customsCity,
        customs_postal_code: customsPostalCode,
        customs_address: customsAddress,
        customs_lat: customsCoords?.lat ?? null,
        customs_lng: customsCoords?.lng ?? null,
        freight_amount: freightAmount,
        freight_currency: freightCurrency,
      },
    ])
    .select('id')
    .single();

  if (cargoErr || !cargo) {
    // откатываем рейс, чтобы не оставлять пустую обёртку
    await supabase.from('trips').delete().eq('id', created.id);
    throw new Error(`Ошибка создания груза: ${cargoErr?.message || 'unknown'}`);
  }

  // ---- 3. Audit ----
  const route = `${fromCity || ''}, ${fromCountry || ''} → ${toCity || ''}, ${toCountry || ''}`;
  await logAudit({
    entity_type: 'trip',
    entity_id: created.id,
    action: 'create',
    summary: `Создана заявка №${created.trip_number ?? '—'}${clientName ? ' · ' + clientName : ''}${route ? ' · ' + route : ''}`,
  });

  revalidatePath('/trips');
  redirect(`/trips/${created.id}?toast=cargo_created`);
}

// ============================================================
// @deprecated — старая логика «создать рейс сразу с транспортом».
// Не вызывается из UI. Оставлено на один коммит для отката.
// ============================================================
/** @deprecated Используйте createCargoWithTrip */
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

  const fromCountry = formData.get('from_country') as string;
  const fromName = formData.get('from_name') as string;
  const fromPostalCode = formData.get('from_postal_code') as string;
  const fromCity = formData.get('from_city') as string;
  const fromAddress = formData.get('from_address') as string;

  const toCountry = formData.get('to_country') as string;
  const toName = formData.get('to_name') as string;
  const toPostalCode = formData.get('to_postal_code') as string;
  const toCity = formData.get('to_city') as string;
  const toAddress = formData.get('to_address') as string;

  const route = `${fromCity || ''}, ${fromCountry || ''} → ${toCity || ''}, ${toCountry || ''}`;

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

      startFuelLevel = consumed > 0
        ? prevStart + totalRefuel - consumed
        : prevStart + totalRefuel;
      if (startFuelLevel < 0) startFuelLevel = 0;
    }
  }

  const fromCoords = await geocode(fromCity, fromCountry, fromPostalCode);
  const toCoords = await geocode(toCity, toCountry, toPostalCode);

  const startLat = fromCoords?.lat ?? 0;
  const startLng = fromCoords?.lng ?? 0;
  const endLat = toCoords?.lat ?? 0;
  const endLng = toCoords?.lng ?? 0;

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
        start_lat: startLat,
        start_lng: startLng,
        end_lat: endLat,
        end_lng: endLng,
        trip_number: 0,
        status: 'planned',
      },
    ])
    .select('id, trip_number')
    .single();

  if (error || !created) throw new Error(`Ошибка создания рейса: ${error?.message || 'unknown'}`);

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
        from_country: fromCountry || null,
        from_city: fromCity || null,
        from_company: fromName || null,
        from_address: fromAddress || null,
        from_postal_code: fromPostalCode || null,
        to_country: toCountry || null,
        to_city: toCity || null,
        to_company: toName || null,
        to_address: toAddress || null,
        to_postal_code: toPostalCode || null,
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
          from_country: fromCountry || null,
          from_city: fromCity || null,
          from_company: fromName || null,
          from_address: fromAddress || null,
          from_postal_code: fromPostalCode || null,
          to_country: toCountry || null,
          to_city: toCity || null,
          to_company: toName || null,
          to_address: toAddress || null,
          to_postal_code: toPostalCode || null,
        }])
        .select('id')
        .single();

      if (cargoErr || !cargo) {
        console.error('[addTrip] cargo insert failed:', cargoErr?.message);
      } else {
        const { error: linkErr } = await supabase
          .from('trip_segment_cargo')
          .insert([{ segment_id: segment.id, cargo_id: cargo.id }]);
        if (linkErr) console.error('[addTrip] segment_cargo link failed:', linkErr.message);
      }
    }
  } catch (e) {
    console.error('[addTrip] auto-segment exception:', e);
  }

  const finalNumber = created.trip_number ?? 0;

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
      { name: fromName, city: fromCity, country: fromCountry },
      { name: toName, city: toCity, country: toCountry }
    );
  }

  revalidatePath('/trips');
  redirect('/trips?toast=trip_created');
}
