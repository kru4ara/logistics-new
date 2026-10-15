'use server';

import { createClient } from '../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logAudit, diffFields } from '../lib/audit';

// ============================================================
// Конвертация в EUR по курсу на дату
// ============================================================
async function toEur(
  supabase: Awaited<ReturnType<typeof createClient>>,
  amount: number,
  currency: string,
  date: string
): Promise<number> {
  if (currency === 'EUR' || !currency) return amount;
  if (currency === 'PLN') {
    const { data: rate } = await supabase
      .from('rates')
      .select('pln_to_eur')
      .lte('rate_date', date)
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();
    return amount * (rate?.pln_to_eur ?? 0.23);
  }
  if (currency === 'BYN') {
    const { data: rate } = await supabase
      .from('rates')
      .select('byn_to_eur')
      .lte('rate_date', date)
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();
    return amount * (rate?.byn_to_eur ?? 0.30);
  }
  return amount;
}

// ============================================================
// Добавление расхода
// ============================================================
export async function addExpense(formData: FormData) {
  const supabase = await createClient();

  const tripId = formData.get('trip_id') as string;
  const category = formData.get('category') as string;
  const originalAmount = parseFloat(formData.get('amount') as string) || 0;
  const currency = formData.get('currency') as string;
  const liters = parseFloat(formData.get('liters') as string) || 0;
  const description = formData.get('description') as string;
  const expenseDate = formData.get('expense_date') as string;
  const segmentId = (formData.get('segment_id') as string) || null;

  // ⬅️ НОВОЕ: чекбокс "оплатил водитель за свои"
  const paidByDriver = formData.get('paid_by_driver') === 'true';

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

  const { data: created, error } = await supabase
    .from('trip_expenses')
    .insert([
      {
        trip_id: tripId,
        segment_id: segmentId,
        category: category,
        amount_eur: amountEur,
        original_amount: originalAmount,
        currency: currency,
        liters: category === 'fuel' ? liters : null,
        description: description,
        expense_date: expenseDate || null,
        paid_by_driver: paidByDriver, // ⬅️ НОВОЕ
      }
    ])
    .select('id')
    .single();

  if (error) throw new Error(`Ошибка добавления: ${error.message}`);

  if (created?.id) {
    await logAudit({
      entity_type: 'trip_expense',
      entity_id: created.id,
      action: 'create',
      summary: `Добавлен расход по рейсу: ${category} · ${originalAmount} ${currency} (≈ ${Math.round(amountEur * 100) / 100} €)${segmentId ? ' · привязан к участку' : ''}${paidByDriver ? ' · оплатил водитель' : ''}`,
    });

    // ⬅️ НОВОЕ: если расход за счёт водителя — начисляем долг
    if (paidByDriver && amountEur > 0) {
      try {
        const { data: trip } = await supabase
          .from('trips')
          .select('driver_id')
          .eq('id', tripId)
          .maybeSingle();

        const driverId = trip?.driver_id;

        if (driverId) {
          const { data: dt, error: dtErr } = await supabase
            .from('driver_transactions')
            .insert([
              {
                driver_id: driverId,
                trip_id: tripId,
                expense_id: created.id,
                type: 'accrual',
                amount_eur: amountEur,
                original_amount: originalAmount,
                currency,
                date: expenseDate || dateForRate,
                notes: `Расход по рейсу: ${category}${description ? ' · ' + description : ''}`,
              },
            ])
            .select('id')
            .single();

          if (dtErr) {
            console.error('[addExpense] driver_transaction insert failed:', dtErr.message);
          } else if (dt?.id) {
            await logAudit({
              entity_type: 'driver_transaction',
              entity_id: dt.id,
              action: 'create',
              summary: `Начислен долг водителю за расход: ${originalAmount} ${currency} (≈ ${Math.round(amountEur * 100) / 100} €)`,
            });
          }
        } else {
          console.warn('[addExpense] paid_by_driver=true, но у рейса нет водителя — долг не начислен');
        }
      } catch (e) {
        console.error('[addExpense] driver_debt exception:', e);
      }
    }
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/trips');
  redirect(`/trips/${tripId}?toast=expense_added`);
}

// ============================================================
// Удаление расхода
// ============================================================
export async function deleteExpense(expenseId: string, tripId: string) {
  const supabase = await createClient();

  const { data: before } = await supabase
    .from('trip_expenses')
    .select('category, amount_eur, original_amount, currency')
    .eq('id', expenseId)
    .maybeSingle();

  const { error } = await supabase
    .from('trip_expenses')
    .delete()
    .eq('id', expenseId);
  if (error) throw new Error(`Ошибка удаления: ${error.message}`);

  await logAudit({
    entity_type: 'trip_expense',
    entity_id: expenseId,
    action: 'delete',
    summary: before
      ? `Удалён расход: ${before.category} · ${before.original_amount} ${before.currency}`
      : 'Удалён расход (данные не сохранились)',
  });

  // ⬅️ ПРИМЕЧАНИЕ: driver_transactions.expense_id с ON DELETE SET NULL —
  // при удалении расхода связанное начисление ОСТАЁТСЯ (долг не пропадает).
  // Если нужно — офис удалит операцию вручную на карточке водителя.

  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/trips');
  redirect(`/trips/${tripId}?toast=expense_deleted`);
}

// ============================================================
// Редактирование рейса
// ============================================================
export async function updateTrip(tripId: string, formData: FormData) {
  const supabase = await createClient();

  const clientId = formData.get('client_id') as string;
  const truckId = formData.get('truck_id') as string;
  const trailerId = formData.get('trailer_id') as string;
  const driverId = formData.get('driver_id') as string;
  const startDate = formData.get('start_date') as string;
  const endDate = (formData.get('end_date') as string) || null;
  const revenueEur = parseFloat(formData.get('revenue_eur') as string) || 0;
  const startFuelLevel = parseFloat(formData.get('start_fuel_level') as string) || 0;

  const clientRequestNumber = formData.get('client_request_number') as string;
  const clientRequestDate = formData.get('client_request_date') as string;

  const fromCountry = formData.get('from_country') as string;
  const fromName = formData.get('from_name') as string;
  const fromPostalCode = formData.get('from_postal_code') as string;
  const fromCity = formData.get('from_city') as string;
  const fromAddress = formData.get('from_address') as string;
  const fromLoadingNumber = formData.get('from_loading_number') as string;

  const toCountry = formData.get('to_country') as string;
  const toName = formData.get('to_name') as string;
  const toPostalCode = formData.get('to_postal_code') as string;
  const toCity = formData.get('to_city') as string;
  const toAddress = formData.get('to_address') as string;
  const toLoadingNumber = formData.get('to_loading_number') as string;

  if (endDate && startDate) {
    const s = new Date(startDate).getTime();
    const e = new Date(endDate).getTime();
    if (e < s) {
      throw new Error('Дата финиша не может быть раньше даты старта');
    }
  }

  const { data: before } = await supabase
    .from('trips')
    .select('trip_number, revenue_eur, driver_id, truck_id, client_id, start_date, end_date, client_request_number, start_fuel_level, start_lat, start_lng, end_lat, end_lng')
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

  let startLat = before?.start_lat ?? 0;
  let startLng = before?.start_lng ?? 0;
  let endLat = before?.end_lat ?? 0;
  let endLng = before?.end_lng ?? 0;

  if (fromCity && fromCountry) {
    const c = await geocode(fromCity, fromCountry);
    if (c) { startLat = c.lat; startLng = c.lng; }
  }
  if (toCity && toCountry) {
    const c = await geocode(toCity, toCountry);
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
      end_date: endDate,
      revenue_eur: revenueEur,
      start_fuel_level: startFuelLevel,
      client_request_number: clientRequestNumber || null,
      client_request_date: clientRequestDate || null,
      start_lat: startLat,
      start_lng: startLng,
      end_lat: endLat,
      end_lng: endLng
    })
    .eq('id', tripId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);

  if (before) {
    const changes = diffFields(
      {
        revenue_eur: before.revenue_eur,
        driver_id: before.driver_id,
        truck_id: before.truck_id,
        client_id: before.client_id,
        start_date: before.start_date,
        end_date: before.end_date,
        client_request_number: before.client_request_number,
        start_fuel_level: before.start_fuel_level,
      },
      {
        revenue_eur: revenueEur,
        driver_id: driverId || null,
        truck_id: truckId || null,
        client_id: clientId || null,
        start_date: startDate,
        end_date: endDate,
        client_request_number: clientRequestNumber || null,
        start_fuel_level: startFuelLevel,
      },
      ['revenue_eur', 'driver_id', 'truck_id', 'client_id', 'start_date', 'end_date', 'client_request_number', 'start_fuel_level']
    );

    const changedCount = Object.keys(changes).length;
    if (changedCount > 0) {
      await logAudit({
        entity_type: 'trip',
        entity_id: tripId,
        action: 'update',
        summary: `Рейс №${before.trip_number ?? '—'}: изменено ${changedCount} ${changedCount === 1 ? 'поле' : 'полей'}`,
        changes,
      });
    }
  }

  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}?toast=trip_updated`);
}

// ============================================================
// Удаление рейса
// ============================================================
export async function deleteTrip(tripId: string) {
  const supabase = await createClient();

  const { data: tripInfo } = await supabase
    .from('trips')
    .select('trip_number, revenue_eur')
    .eq('id', tripId)
    .maybeSingle();

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

  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'delete',
    summary: tripInfo
      ? `Удалён рейс №${tripInfo.trip_number ?? '—'} (фрахт ${tripInfo.revenue_eur ?? 0} €)`
      : 'Удалён рейс',
  });

  revalidatePath('/trips');
  redirect('/trips?toast=trip_deleted');
}
