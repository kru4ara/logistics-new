'use server';

import { createClient } from '../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Добавление расхода
export async function addExpense(formData: FormData) {
  const supabase = await createClient();

  const tripId = formData.get('trip_id') as string;
  const category = formData.get('category') as string;
  const originalAmount = parseFloat(formData.get('amount') as string) || 0;
  const currency = formData.get('currency') as string;
  const liters = parseFloat(formData.get('liters') as string) || 0;
  const description = formData.get('description') as string;
  const expenseDate = formData.get('expense_date') as string;

  const dateForRate = expenseDate || new Date().toISOString().split('T')[0];
  let amountEur = originalAmount;

  if (currency === 'PLN') {
    const { data: rate } = await supabase
      .from('rates')
      .select('pln_to_eur')
      .lte('rate_date', dateForRate)
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();
    amountEur = originalAmount * (rate?.pln_to_eur ?? 0.23);
  } else if (currency === 'BYN') {
    const { data: rate } = await supabase
      .from('rates')
      .select('byn_to_eur')
      .lte('rate_date', dateForRate)
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();
    amountEur = originalAmount * (rate?.byn_to_eur ?? 0.30);
  }

  const { error } = await supabase
    .from('trip_expenses')
    .insert([
      {
        trip_id: tripId,
        category: category,
        amount_eur: amountEur,
        original_amount: originalAmount,
        currency: currency,
        liters: category === 'fuel' ? liters : null,
        description: description,
        expense_date: expenseDate || null
      }
    ]);

  if (error) throw new Error(`Ошибка добавления: ${error.message}`);
  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/trips');
}

// Удаление расхода
export async function deleteExpense(expenseId: string, tripId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('trip_expenses')
    .delete()
    .eq('id', expenseId);
  if (error) throw new Error(`Ошибка удаления: ${error.message}`);
  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/trips');
}

// Редактирование рейса
export async function updateTrip(tripId: string, formData: FormData) {
  const supabase = await createClient();

  const clientId = formData.get('client_id') as string;
  const truckId = formData.get('truck_id') as string;
  const trailerId = formData.get('trailer_id') as string;
  const driverId = formData.get('driver_id') as string;
  const startDate = formData.get('start_date') as string;
  const revenueEur = parseFloat(formData.get('revenue_eur') as string) || 0;
  const startFuelLevel = parseFloat(formData.get('start_fuel_level') as string) || 0;

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
  // ГЕОКОДИРОВАНИЕ — пересчитываем, если адреса изменились
  // ============================================================
  const { data: existing } = await supabase
    .from('trips')
    .select('start_lat, start_lng, end_lat, end_lng, sender_city, sender_country, receiver_city, receiver_country')
    .eq('id', tripId)
    .single();

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
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch (e) {
      console.error('Ошибка геокодирования:', e);
    }
    return null;
  }

  let startLat = existing?.start_lat ?? 0;
  let startLng = existing?.start_lng ?? 0;
  let endLat = existing?.end_lat ?? 0;
  let endLng = existing?.end_lng ?? 0;

  const senderChanged =
    !existing ||
    existing.sender_city !== senderCity ||
    existing.sender_country !== senderCountry ||
    !existing.start_lat;

  const receiverChanged =
    !existing ||
    existing.receiver_city !== receiverCity ||
    existing.receiver_country !== receiverCountry ||
    !existing.end_lat;

  if (senderChanged) {
    const c = await geocode(senderCity, senderCountry);
    if (c) { startLat = c.lat; startLng = c.lng; }
  }

  if (receiverChanged) {
    const c = await geocode(receiverCity, receiverCountry);
    if (c) { endLat = c.lat; endLng = c.lng; }
  }

  const { error } = await supabase
    .from('trips')
    .update({
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
      end_lat: endLat,
      end_lng: endLng
    })
    .eq('id', tripId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

// Удаление рейса
export async function deleteTrip(tripId: string) {
  const supabase = await createClient();

  const { error: expensesError } = await supabase
    .from('trip_expenses')
    .delete()
    .eq('trip_id', tripId);
  if (expensesError) throw new Error(`Ошибка удаления расходов: ${expensesError.message}`);

  const { error: docsError } = await supabase
    .from('trip_documents')
    .delete()
    .eq('trip_id', tripId);
  if (docsError) throw new Error(`Ошибка удаления документов: ${docsError.message}`);

  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', tripId);
  if (error) throw new Error(`Ошибка удаления рейса: ${error.message}`);

  revalidatePath('/trips');
  redirect('/trips');
}
