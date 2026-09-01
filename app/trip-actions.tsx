'use server';

import { supabase } from '../lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Добавление расхода
export async function addExpense(formData: FormData) {
  const tripId = formData.get('trip_id') as string;
  const category = formData.get('category') as string;
  const originalAmount = parseFloat(formData.get('amount') as string) || 0;
  const currency = formData.get('currency') as string;
  const liters = parseFloat(formData.get('liters') as string) || 0;
  const description = formData.get('description') as string;
  const expenseDate = formData.get('expense_date') as string;

  // Если дата не указана, используем сегодняшнюю
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
  const { error } = await supabase
    .from('trip_expenses')
    .delete()
    .eq('id', expenseId);
  if (error) throw new Error(`Ошибка удаления: ${error.message}`);
  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/trips');
}

// Редактирование рейса (с новыми полями)
export async function updateTrip(tripId: string, formData: FormData) {
  const clientId = formData.get('client_id') as string;
  const truckId = formData.get('truck_id') as string;
  const startDate = formData.get('start_date') as string;
  const revenueEur = parseFloat(formData.get('revenue_eur') as string) || 0;
  const startFuelLevel = parseFloat(formData.get('start_fuel_level') as string) || 0; // Остаток топлива

  // Данные заявки
  const clientRequestNumber = formData.get('client_request_number') as string;
  const clientRequestDate = formData.get('client_request_date') as string;

  // Отправитель
  const senderCountry = formData.get('sender_country') as string;
  const senderName = formData.get('sender_name') as string;
  const senderPostalCode = formData.get('sender_postal_code') as string;
  const senderCity = formData.get('sender_city') as string;
  const senderAddress = formData.get('sender_address') as string;
  const senderLoadingNumber = formData.get('sender_loading_number') as string;

  // Получатель
  const receiverCountry = formData.get('receiver_country') as string;
  const receiverName = formData.get('receiver_name') as string;
  const receiverPostalCode = formData.get('receiver_postal_code') as string;
  const receiverCity = formData.get('receiver_city') as string;
  const receiverAddress = formData.get('receiver_address') as string;
  const receiverLoadingNumber = formData.get('receiver_loading_number') as string;

  // Маршрут (если вручную не заполнен — собираем из городов)
  const route = formData.get('route') as string || `${senderCity || ''}, ${senderCountry || ''} → ${receiverCity || ''}, ${receiverCountry || ''}`;

  const { error } = await supabase
    .from('trips')
    .update({
      client_id: clientId || null,
      truck_id: truckId || null,
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
      route: route || null
    })
    .eq('id', tripId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

// Удаление рейса
export async function deleteTrip(tripId: string) {
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
