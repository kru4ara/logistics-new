'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../../lib/supabase-server';
import { logAudit } from '../../../lib/audit';

function str(formData: FormData, key: string): string | null {
  const v = (formData.get(key) as string)?.trim();
  return v || null;
}

function parseCargoIds(formData: FormData): string[] {
  const ids = formData.getAll('cargo_ids') as string[];
  return ids.filter(Boolean);
}

type Stop = {
  type: 'load' | 'reload' | 'unload';
  company: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  postal_code: string | null;
  date: string | null;
};

function parseStops(formData: FormData): Stop[] {
  const raw = formData.get('stops') as string;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((s: any) => s && (s.company || s.city || s.country || s.address))
      .map((s: any) => ({
        type: ['load', 'unload', 'customs'].includes(s.type) ? s.type : 'reload',
        company: String(s.company || '').trim() || null,
        country: String(s.country || '').trim() || null,
        city: String(s.city || '').trim() || null,
        address: String(s.address || '').trim() || null,
        postal_code: String(s.postal_code || '').trim() || null,
        date: s.date || null,
      }));
  } catch {
    return [];
  }
}

// Конвертация в EUR по курсу на дату
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

// Удалить расход, привязанный к сегменту (при изменении/удалении)
async function deleteSegmentExpense(
  supabase: Awaited<ReturnType<typeof createClient>>,
  segmentId: string
) {
  await supabase
    .from('trip_expenses')
    .delete()
    .eq('segment_id', segmentId);
}

// Создать расход для сегмента-подрядчика
async function createSegmentExpense(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
  segmentId: string,
  contractorId: string,
  price: number,
  currency: string,
  dateForRate: string,
  expenseDate: string | null,
  routeHint: string
) {
  const { data: contractor } = await supabase
    .from('contractors')
    .select('name')
    .eq('id', contractorId)
    .maybeSingle();

  const contractorName = contractor?.name || 'Подрядчик';
  const amountEur = await toEur(supabase, price, currency, dateForRate);

  const { error } = await supabase
    .from('trip_expenses')
    .insert([{
      trip_id: tripId,
      segment_id: segmentId,
      subcontractor_id: null,
      category: 'contractor',
      amount_eur: amountEur,
      original_amount: price,
      currency: currency,
      liters: null,
      description: `Подрядчик: ${contractorName}${routeHint ? ` · ${routeHint}` : ''}`,
      expense_date: expenseDate || null,
    }]);

  if (error) {
    console.error('[segment-actions] expense insert failed:', error.message);
  }
}

export async function createSegment(tripId: string, formData: FormData) {
  const supabase = await createClient();

  const executorType = str(formData, 'executor_type') || 'us';
  const contractorId = str(formData, 'contractor_id');
  const truckId = str(formData, 'truck_id');
  const driverId = str(formData, 'driver_id');
  const dateFrom = str(formData, 'date_from');
  const dateTo = str(formData, 'date_to');
  const notes = str(formData, 'notes');
  const cargoIds = parseCargoIds(formData);
  const stops = parseStops(formData);

  const priceRaw = str(formData, 'price');
  const price = priceRaw ? parseFloat(priceRaw) : null;
  const currency = str(formData, 'currency') || 'EUR';

  if (executorType === 'contractor' && !contractorId) {
    throw new Error('Выберите подрядчика');
  }
  if (cargoIds.length === 0) {
    throw new Error('Выберите хотя бы один груз');
  }

  const fromCountry = str(formData, 'from_country');
  const fromCity = str(formData, 'from_city');
  const fromCompany = str(formData, 'from_company');
  const fromAddress = str(formData, 'from_address');
  const fromPostalCode = str(formData, 'from_postal_code');

  const toCountry = str(formData, 'to_country');
  const toCity = str(formData, 'to_city');
  const toCompany = str(formData, 'to_company');
  const toAddress = str(formData, 'to_address');
  const toPostalCode = str(formData, 'to_postal_code');

  const { data: last } = await supabase
    .from('trip_segments')
    .select('position')
    .eq('trip_id', tripId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (last?.position || 0) + 1;

  const { data: created, error } = await supabase
    .from('trip_segments')
    .insert([{
      trip_id: tripId,
      position: nextPosition,
      executor_type: executorType,
      contractor_id: executorType === 'contractor' ? contractorId : null,
      truck_id: executorType === 'us' ? truckId : null,
      driver_id: executorType === 'us' ? driverId : null,
      date_from: dateFrom,
      date_to: dateTo,
      from_country: fromCountry,
      from_city: fromCity,
      from_company: fromCompany,
      from_address: fromAddress,
      from_postal_code: fromPostalCode,
      to_country: toCountry,
      to_city: toCity,
      to_company: toCompany,
      to_address: toAddress,
      to_postal_code: toPostalCode,
      stops: stops as any,
      notes,
      price: executorType === 'contractor' ? price : null,
      currency: executorType === 'contractor' ? currency : null,
    }])
    .select('id')
    .single();

  if (error || !created) throw new Error(`Ошибка создания участка: ${error?.message || 'unknown'}`);

  const links = cargoIds.map((cid) => ({ segment_id: created.id, cargo_id: cid }));
  const { error: linkErr } = await supabase
    .from('trip_segment_cargo')
    .insert(links);
  if (linkErr) throw new Error(`Ошибка привязки грузов: ${linkErr.message}`);

  // Автоматически создаём расход, если это подрядчик с ценой
  if (executorType === 'contractor' && contractorId && price && price > 0) {
    const dateForRate = dateFrom || new Date().toISOString().split('T')[0];
    const routeHint = [fromCity, toCity].filter(Boolean).join(' → ');
    await createSegmentExpense(
      supabase,
      tripId,
      created.id,
      contractorId,
      price,
      currency,
      dateForRate,
      dateFrom,
      routeHint
    );
  }

  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    summary: `Добавлен участок №${nextPosition} (${executorType === 'us' ? 'мы' : 'подрядчик'}, грузов: ${cargoIds.length}${price ? `, цена: ${price} ${currency}` : ''})`,
  });

  revalidatePath(`/trips/${tripId}`);
  return { success: true, id: created.id };
}

export async function updateSegment(segmentId: string, tripId: string, formData: FormData) {
  const supabase = await createClient();

  const executorType = str(formData, 'executor_type') || 'us';
  const contractorId = str(formData, 'contractor_id');
  const truckId = str(formData, 'truck_id');
  const driverId = str(formData, 'driver_id');
  const dateFrom = str(formData, 'date_from');
  const dateTo = str(formData, 'date_to');
  const notes = str(formData, 'notes');
  const cargoIds = parseCargoIds(formData);
  const stops = parseStops(formData);

  const priceRaw = str(formData, 'price');
  const price = priceRaw ? parseFloat(priceRaw) : null;
  const currency = str(formData, 'currency') || 'EUR';

  if (executorType === 'contractor' && !contractorId) {
    throw new Error('Выберите подрядчика');
  }
  if (cargoIds.length === 0) {
    throw new Error('Выберите хотя бы один груз');
  }

  const fromCountry = str(formData, 'from_country');
  const fromCity = str(formData, 'from_city');
  const fromCompany = str(formData, 'from_company');
  const fromAddress = str(formData, 'from_address');
  const fromPostalCode = str(formData, 'from_postal_code');

  const toCountry = str(formData, 'to_country');
  const toCity = str(formData, 'to_city');
  const toCompany = str(formData, 'to_company');
  const toAddress = str(formData, 'to_address');
  const toPostalCode = str(formData, 'to_postal_code');

  const { error } = await supabase
    .from('trip_segments')
    .update({
      executor_type: executorType,
      contractor_id: executorType === 'contractor' ? contractorId : null,
      truck_id: executorType === 'us' ? truckId : null,
      driver_id: executorType === 'us' ? driverId : null,
      date_from: dateFrom,
      date_to: dateTo,
      from_country: fromCountry,
      from_city: fromCity,
      from_company: fromCompany,
      from_address: fromAddress,
      from_postal_code: fromPostalCode,
      to_country: toCountry,
      to_city: toCity,
      to_company: toCompany,
      to_address: toAddress,
      to_postal_code: toPostalCode,
      stops: stops as any,
      notes,
      price: executorType === 'contractor' ? price : null,
      currency: executorType === 'contractor' ? currency : null,
    })
    .eq('id', segmentId);

  if (error) throw new Error(`Ошибка обновления участка: ${error.message}`);

  // Обновить привязку грузов
  await supabase
    .from('trip_segment_cargo')
    .delete()
    .eq('segment_id', segmentId);

  const links = cargoIds.map((cid) => ({ segment_id: segmentId, cargo_id: cid }));
  const { error: linkErr } = await supabase
    .from('trip_segment_cargo')
    .insert(links);
  if (linkErr) throw new Error(`Ошибка привязки грузов: ${linkErr.message}`);

  // Синхронизация расхода: удаляем старый, если он был
  await deleteSegmentExpense(supabase, segmentId);

  // Создаём новый, если это подрядчик с ценой
  if (executorType === 'contractor' && contractorId && price && price > 0) {
    const dateForRate = dateFrom || new Date().toISOString().split('T')[0];
    const routeHint = [fromCity, toCity].filter(Boolean).join(' → ');
    await createSegmentExpense(
      supabase,
      tripId,
      segmentId,
      contractorId,
      price,
      currency,
      dateForRate,
      dateFrom,
      routeHint
    );
  }

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
}

export async function deleteSegment(segmentId: string, tripId: string) {
  const supabase = await createClient();

  const { data: before } = await supabase
    .from('trip_segments')
    .select('position')
    .eq('id', segmentId)
    .maybeSingle();

  // Удаляем связанный расход
  await deleteSegmentExpense(supabase, segmentId);

  // Удаляем сам сегмент
  const { error } = await supabase
    .from('trip_segments')
    .delete()
    .eq('id', segmentId);

  if (error) throw new Error(`Ошибка удаления участка: ${error.message}`);

  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    summary: `Удалён участок №${before?.position || '—'}`,
  });

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
}
