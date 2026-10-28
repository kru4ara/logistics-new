'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../../lib/supabase/admin';
import { logAudit } from '../../../lib/audit';

function str(formData: FormData, key: string): string | null {
  const v = (formData.get(key) as string)?.trim();
  return v || null;
}

// Конвертация в EUR (EUR / PLN / BYN)
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

// Синхронизация трипса: revenue_eur = сумма фрахтов всех грузов
async function syncTripRevenue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string
) {
  // 1. Получаем дату заявки для курса
  const { data: trip } = await supabase
    .from('trips')
    .select('client_request_date')
    .eq('id', tripId)
    .maybeSingle();
  const dateForRate = trip?.client_request_date || new Date().toISOString().slice(0, 10);

  // 2. Получаем все грузы рейса
  const { data: cargos } = await supabase
    .from('trip_cargo')
    .select('freight_amount, freight_currency')
    .eq('trip_id', tripId);

  if (!cargos) return;

  // 3. Считаем сумму в EUR
  let totalEur = 0;
  for (const c of cargos) {
    const amount = Number(c.freight_amount) || 0;
    const currency = c.freight_currency || 'EUR';
    totalEur += await toEur(supabase, amount, currency, dateForRate);
  }

  // 4. Обновляем рейс
  await supabase
    .from('trips')
    .update({ revenue_eur: totalEur })
    .eq('id', tripId);
}

export async function createCargo(tripId: string, formData: FormData) {
  const supabase = await createClient();

  const label = str(formData, 'label');
  const cargoType = str(formData, 'cargo_type');
  const weightRaw = formData.get('weight_kg') as string;
  const weight = weightRaw ? parseFloat(weightRaw) : null;
  const palletsRaw = formData.get('pallets') as string;
  const pallets = palletsRaw ? parseInt(palletsRaw, 10) : null;
  const clientId = str(formData, 'client_id');
  const notes = str(formData, 'notes');

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

  const customsPlace = str(formData, 'customs_place');
  const customsCountry = str(formData, 'customs_country');
  const customsCity = str(formData, 'customs_city');
  const customsPostalCode = str(formData, 'customs_postal_code');
  const customsAddress = str(formData, 'customs_address');

  const freightRaw = formData.get('freight_amount') as string;
  const freightAmount = freightRaw ? parseFloat(freightRaw) : 0;
  const freightCurrency = (str(formData, 'freight_currency') || 'EUR').toUpperCase();

  if (!label) throw new Error('Укажите название груза');

  const { data: last } = await supabase
    .from('trip_cargo')
    .select('position')
    .eq('trip_id', tripId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (last?.position || 0) + 1;

  const { data: created, error } = await supabase
    .from('trip_cargo')
    .insert([{
      trip_id: tripId,
      position: nextPosition,
      label,
      cargo_type: cargoType,
      weight_kg: weight,
      pallets,
      client_id: clientId,
      notes,
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
      customs_place: customsPlace,
      customs_country: customsCountry,
      customs_city: customsCity,
      customs_postal_code: customsPostalCode,
      customs_address: customsAddress,
      freight_amount: freightAmount,
      freight_currency: freightCurrency,
    }])
    .select('id')
    .single();

  if (error) throw new Error(`Ошибка создания груза: ${error.message}`);

  // Синхронизируем фрахт рейса
  await syncTripRevenue(supabase, tripId);

  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    summary: `Добавлен груз «${label}» (позиция ${nextPosition})`,
    changes: { cargo_added: { before: null, after: label } },
  });

  revalidatePath(`/trips/${tripId}`);
  return { success: true, id: created?.id };
}

export async function updateCargo(cargoId: string, tripId: string, formData: FormData) {
  const supabase = await createClient();

  const label = str(formData, 'label');
  const cargoType = str(formData, 'cargo_type');
  const weightRaw = formData.get('weight_kg') as string;
  const weight = weightRaw ? parseFloat(weightRaw) : null;
  const palletsRaw = formData.get('pallets') as string;
  const pallets = palletsRaw ? parseInt(palletsRaw, 10) : null;
  const clientId = str(formData, 'client_id');
  const notes = str(formData, 'notes');

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

  const customsPlace = str(formData, 'customs_place');
  const customsCountry = str(formData, 'customs_country');
  const customsCity = str(formData, 'customs_city');
  const customsPostalCode = str(formData, 'customs_postal_code');
  const customsAddress = str(formData, 'customs_address');

  const freightRaw = formData.get('freight_amount') as string;
  const freightAmount = freightRaw ? parseFloat(freightRaw) : 0;
  const freightCurrency = (str(formData, 'freight_currency') || 'EUR').toUpperCase();

  if (!label) throw new Error('Укажите название груза');

  const { error } = await supabase
    .from('trip_cargo')
    .update({
      label,
      cargo_type: cargoType,
      weight_kg: weight,
      pallets,
      client_id: clientId,
      notes,
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
      customs_place: customsPlace,
      customs_country: customsCountry,
      customs_city: customsCity,
      customs_postal_code: customsPostalCode,
      customs_address: customsAddress,
      freight_amount: freightAmount,
      freight_currency: freightCurrency,
    })
    .eq('id', cargoId);

  if (error) throw new Error(`Ошибка обновления груза: ${error.message}`);

  // Синхронизируем фрахт рейса
  await syncTripRevenue(supabase, tripId);

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
}

export async function deleteCargo(cargoId: string, tripId: string) {
  const supabase = await createClient();

  const { data: before } = await supabase
    .from('trip_cargo')
    .select('label')
    .eq('id', cargoId)
    .maybeSingle();

  const { error } = await supabase
    .from('trip_cargo')
    .delete()
    .eq('id', cargoId);

  if (error) throw new Error(`Ошибка удаления груза: ${error.message}`);

  // Синхронизируем фрахт рейса
  await syncTripRevenue(supabase, tripId);

  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    summary: `Удалён груз «${before?.label || '—'}»`,
    changes: { cargo_deleted: { before: before?.label || '—', after: null } },
  });

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
}
