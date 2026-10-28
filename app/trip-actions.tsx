'use server';

import { createClient } from '../lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logAudit, diffFields } from '../lib/audit';
import { geocode } from '../lib/geocode';

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
        paid_by_driver: paidByDriver,
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

    const isSalary = category === 'salary';
    const shouldAccrue = (paidByDriver || isSalary) && amountEur > 0;

    if (shouldAccrue) {
      try {
        const { data: trip } = await supabase
          .from('trips')
          .select('driver_id, trip_number')
          .eq('id', tripId)
          .maybeSingle();

        const driverId = trip?.driver_id;

        if (driverId) {
          const notesText = isSalary
            ? `ЗП за рейс №${trip?.trip_number ?? '—'}`
            : `Расход по рейсу: ${category}${description ? ' · ' + description : ''}`;

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
                notes: notesText,
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
              summary: isSalary
                ? `Начислена ЗП водителю: ${originalAmount} ${currency} (≈ ${Math.round(amountEur * 100) / 100} €)`
                : `Начислен долг водителю за расход: ${originalAmount} ${currency} (≈ ${Math.round(amountEur * 100) / 100} €)`,
            });
          }
        } else {
          console.warn('[addExpense] нет водителя — долг не начислен');
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

  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/trips');
  redirect(`/trips/${tripId}?toast=expense_deleted`);
}

export async function updateExpense(expenseId: string, formData: FormData) {
  const supabase = await createClient();
  const tripId = formData.get('trip_id') as string;
  
  const category = formData.get('category') as string;
  const original_amount = parseFloat(formData.get('original_amount') as string) || 0;
  const currency = formData.get('currency') as string;
  const amount_eur = parseFloat(formData.get('amount_eur') as string) || 0;
  const description = (formData.get('description') as string)?.trim() || null;
  const expense_date = (formData.get('expense_date') as string) || null;
  const paid_by_driver = formData.get('paid_by_driver') === 'on';

  const { error } = await supabase
    .from('trip_expenses')
    .update({
      category,
      original_amount,
      currency,
      amount_eur,
      description,
      expense_date,
      paid_by_driver,
    })
    .eq('id', expenseId);

  if (error) throw new Error(`Ошибка обновления расхода: ${error.message}`);

  // Пересчитываем баланс водителя, если это ЗП или оплачено им
  // (упрощенно: просто ревалидируем пути)
  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/drivers');
  return { success: true };
}

// ============================================================
// Редактирование рейса (ЗАЯВКА + МАРШРУТ)
// Транспорт, даты и фрахт НЕ трогаем — они синхронизируются
// из trip_segments и trip_cargo.
// ============================================================
export async function updateTrip(tripId: string, formData: FormData) {
  const supabase = await createClient();

  const clientId = formData.get('client_id') as string;
  const startFuelLevel = parseFloat(formData.get('start_fuel_level') as string) || 0;

  const clientRequestNumber = formData.get('client_request_number') as string;
  const clientRequestDate = formData.get('client_request_date') as string;

  const fromCountry = formData.get('from_country') as string;
  const fromPostalCode = formData.get('from_postal_code') as string;
  const fromCity = formData.get('from_city') as string;

  const toCountry = formData.get('to_country') as string;
  const toPostalCode = formData.get('to_postal_code') as string;
  const toCity = formData.get('to_city') as string;

  const { data: before } = await supabase
    .from('trips')
    .select('trip_number, revenue_eur, driver_id, truck_id, client_id, start_date, end_date, client_request_number, start_fuel_level, start_lat, start_lng, end_lat, end_lng')
    .eq('id', tripId)
    .single();

  let startLat = before?.start_lat ?? 0;
  let startLng = before?.start_lng ?? 0;
  let endLat = before?.end_lat ?? 0;
  let endLng = before?.end_lng ?? 0;

  if (fromCity && fromCountry) {
    const c = await geocode(fromCity, fromCountry, fromPostalCode);
    if (c) { startLat = c.lat; startLng = c.lng; }
  }
  if (toCity && toCountry) {
    const c = await geocode(toCity, toCountry, toPostalCode);
    if (c) { endLat = c.lat; endLng = c.lng; }
  }

  const { error } = await supabase
    .from('trips')
    .update({
      client_id: clientId || null,
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
        client_id: before.client_id,
        client_request_number: before.client_request_number,
        start_fuel_level: before.start_fuel_level,
      },
      {
        client_id: clientId || null,
        client_request_number: clientRequestNumber || null,
        start_fuel_level: startFuelLevel,
      },
      ['client_id', 'client_request_number', 'start_fuel_level']
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

// ============================================================
// Пересчёт координат рейса по сегментам
// ============================================================
export async function recalcTripCoords(tripId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: segments } = await supabase
    .from('trip_segments')
    .select('position, from_city, from_country, from_postal_code, to_city, to_country, to_postal_code')
    .eq('trip_id', tripId)
    .order('position', { ascending: true });

  if (!segments || segments.length === 0) {
    return { success: false, error: 'У рейса нет сегментов' };
  }

  const first = segments[0];
  const last = segments[segments.length - 1];

  const startCoords = await geocode(first.from_city, first.from_country, first.from_postal_code);
  const endCoords = await geocode(last.to_city, last.to_country, last.to_postal_code);

  const updateData: Record<string, number> = {};
  if (startCoords) {
    updateData.start_lat = startCoords.lat;
    updateData.start_lng = startCoords.lng;
  }
  if (endCoords) {
    updateData.end_lat = endCoords.lat;
    updateData.end_lng = endCoords.lng;
  }

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: 'Не удалось геокодировать ни один город' };
  }

  const { error } = await supabase
    .from('trips')
    .update(updateData)
    .eq('id', tripId);

  if (error) return { success: false, error: error.message };

  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    summary: `Пересчёт координат рейса: ${startCoords ? 'старт OK' : 'старт fail'} · ${endCoords ? 'финиш OK' : 'финиш fail'}`,
  });

  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/map');

  return { success: true };
}
// ============================================================
// Массовый пересчёт координат (для списка /trips)
// ============================================================
const MAX_RECALC_BATCH = 20;

export async function recalcAllTripsCoords(
  tripIds: string[]
): Promise<{ success: boolean; updated: number; failed: number; error?: string }> {
  if (tripIds.length === 0) {
    return { success: false, updated: 0, failed: 0, error: 'Нет рейсов для пересчёта' };
  }
  if (tripIds.length > MAX_RECALC_BATCH) {
    return {
      success: false,
      updated: 0,
      failed: 0,
      error: `Слишком много рейсов (${tripIds.length}). Максимум ${MAX_RECALC_BATCH} за раз. Отфильтруйте список.`,
    };
  }

  const supabase = await createClient();
  let updated = 0;
  let failed = 0;

  for (const tripId of tripIds) {
    try {
      // 1. Все сегменты рейса
      const { data: segments } = await supabase
        .from('trip_segments')
        .select('position, from_city, from_country, from_postal_code, to_city, to_country, to_postal_code')
        .eq('trip_id', tripId)
        .order('position', { ascending: true });

      if (!segments || segments.length === 0) {
        failed++;
        continue;
      }

      const first = segments[0];
      const last = segments[segments.length - 1];

      const startCoords = await geocode(first.from_city, first.from_country, first.from_postal_code);
      const endCoords = await geocode(last.to_city, last.to_country, last.to_postal_code);

      const updateData: Record<string, number> = {};
      if (startCoords) {
        updateData.start_lat = startCoords.lat;
        updateData.start_lng = startCoords.lng;
      }
      if (endCoords) {
        updateData.end_lat = endCoords.lat;
        updateData.end_lng = endCoords.lng;
      }

      if (Object.keys(updateData).length === 0) {
        failed++;
        continue;
      }

      const { error } = await supabase
        .from('trips')
        .update(updateData)
        .eq('id', tripId);

      if (error) {
        failed++;
      } else {
        updated++;
      }
    } catch (e) {
      console.error('[recalcAllTripsCoords] exception for trip', tripId, e);
      failed++;
    }
  }

  revalidatePath('/trips');
  revalidatePath('/map');

  return { success: true, updated, failed };
}
