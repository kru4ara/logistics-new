'use server';

import { createClient } from '../lib/supabase/admin';
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
// Создание заявки/груза (рейс-обёртка + первый груз)
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

  // ---- Маршрут: куда ----
  const toCountry = ((formData.get('to_country') as string) || '').trim() || null;
  const toName = ((formData.get('to_name') as string) || '').trim() || null;
  const toPostalCode = ((formData.get('to_postal_code') as string) || '').trim() || null;
  const toCity = ((formData.get('to_city') as string) || '').trim() || null;
  const toAddress = ((formData.get('to_address') as string) || '').trim() || null;

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

  // ---- Признаки заказа ----
  // Режим расчёта НЕ выбирается: он выводится из назначенного исполнителя
  // (см. sync_trip_from_segment). До назначения режим не определён (null).
  const isForwarding = formData.get('is_forwarding') === '1' || formData.get('is_forwarding') === 'on';
  const costsClosed = formData.get('costs_closed') === '1' || formData.get('costs_closed') === 'on';

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
        // Номер заказа проставляет нумерация (ветка рейсов).
        trip_number: null,
        // Режим пока дефолтный: реальный выводится из сегментов
        // триггером sync_trip_from_segment при назначении исполнителя.
        profit_mode: 'trip',
        is_forwarding: isForwarding,
        costs_closed: costsClosed,
        // Даты загрузки/разгрузки проставляются из сегмента подрядчика,
        // даты старта/финиша — из сегмента с нашей машиной.
        load_date: null,
        unload_date: null,
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
    summary: `Создан заказ №${created.trip_number ?? '—'}${clientName ? ' · ' + clientName : ''}${route ? ' · ' + route : ''}`,
  });

  revalidatePath('/trips');
  redirect(`/trips/${created.id}?toast=cargo_created`);
}
