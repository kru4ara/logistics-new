'use server';

import { createClient } from './supabase-server';
import { revalidatePath } from 'next/cache';
import { logAudit } from './audit';

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

type ParsedSubcontractor = {
  contractor_id: string | null;
  price: number;
  currency: string;
  payment_days: number;
  truck_number: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  // A1
  load_date: string | null;
  load_country: string | null;
  load_city: string | null;
  load_address: string | null;
  load_company: string | null;
  load_postal_code: string | null;
  load_number: string | null;
  // A2
  load2_date: string | null;
  load2_country: string | null;
  load2_city: string | null;
  load2_address: string | null;
  load2_company: string | null;
  load2_postal_code: string | null;
  load2_number: string | null;
  // A3
  load3_date: string | null;
  load3_country: string | null;
  load3_city: string | null;
  load3_address: string | null;
  load3_company: string | null;
  load3_postal_code: string | null;
  load3_number: string | null;
  // A4
  load4_date: string | null;
  load4_country: string | null;
  load4_city: string | null;
  load4_address: string | null;
  load4_company: string | null;
  load4_postal_code: string | null;
  load4_number: string | null;
  // A5
  load5_date: string | null;
  load5_country: string | null;
  load5_city: string | null;
  load5_address: string | null;
  load5_company: string | null;
  load5_postal_code: string | null;
  load5_number: string | null;
  // C
  unload_date: string | null;
  unload_country: string | null;
  unload_city: string | null;
  unload_address: string | null;
  unload_company: string | null;
  unload_postal_code: string | null;
  unload_number: string | null;
  // Прочее
  notes: string | null;
  transport_type: string | null;
  transport_temperature: string | null;
  cargo_type: string | null;
  cargo_quantity: string | null;
  customs_loading: string | null;
  customs_unloading: string | null;
};

function parseSubcontractorForm(formData: FormData): ParsedSubcontractor {
  const trimOrNull = (key: string): string | null => {
    const v = (formData.get(key) as string)?.trim();
    return v || null;
  };

  // Обрабатываем A1..A5 единообразно. Для A1 суффикс пустой,
  // для A2..A5 — «2»..«5» (поля load2_*, load3_* и т.д.)
  const loadPoints: Array<{
    suffix: '' | '2' | '3' | '4' | '5';
    dateKey: string;
    prefix: string;
  }> = [
    { suffix: '', dateKey: 'load_date', prefix: 'load' },
    { suffix: '2', dateKey: 'load2_date', prefix: 'load2' },
    { suffix: '3', dateKey: 'load3_date', prefix: 'load3' },
    { suffix: '4', dateKey: 'load4_date', prefix: 'load4' },
    { suffix: '5', dateKey: 'load5_date', prefix: 'load5' },
  ];

  const parsedLoads = loadPoints.map((lp) => ({
    date: trimOrNull(lp.dateKey),
    country: trimOrNull(`${lp.prefix}_country`),
    city: trimOrNull(`${lp.prefix}_city`),
    address: trimOrNull(`${lp.prefix}_address`),
    company: trimOrNull(`${lp.prefix}_company`),
    postal_code: trimOrNull(`${lp.prefix}_postal_code`),
    number: trimOrNull(`${lp.prefix}_number`),
  }));

  return {
    contractor_id: trimOrNull('contractor_id'),
    price: parseFloat(formData.get('price') as string) || 0,
    currency: (formData.get('currency') as string) || 'EUR',
    payment_days: parseInt(formData.get('payment_days') as string) || 30,
    truck_number: trimOrNull('truck_number'),
    driver_name: trimOrNull('driver_name'),
    driver_phone: trimOrNull('driver_phone'),

    // A1
    load_date: parsedLoads[0].date,
    load_country: parsedLoads[0].country,
    load_city: parsedLoads[0].city,
    load_address: parsedLoads[0].address,
    load_company: parsedLoads[0].company,
    load_postal_code: parsedLoads[0].postal_code,
    load_number: parsedLoads[0].number,
    // A2
    load2_date: parsedLoads[1].date,
    load2_country: parsedLoads[1].country,
    load2_city: parsedLoads[1].city,
    load2_address: parsedLoads[1].address,
    load2_company: parsedLoads[1].company,
    load2_postal_code: parsedLoads[1].postal_code,
    load2_number: parsedLoads[1].number,
    // A3
    load3_date: parsedLoads[2].date,
    load3_country: parsedLoads[2].country,
    load3_city: parsedLoads[2].city,
    load3_address: parsedLoads[2].address,
    load3_company: parsedLoads[2].company,
    load3_postal_code: parsedLoads[2].postal_code,
    load3_number: parsedLoads[2].number,
    // A4
    load4_date: parsedLoads[3].date,
    load4_country: parsedLoads[3].country,
    load4_city: parsedLoads[3].city,
    load4_address: parsedLoads[3].address,
    load4_company: parsedLoads[3].company,
    load4_postal_code: parsedLoads[3].postal_code,
    load4_number: parsedLoads[3].number,
    // A5
    load5_date: parsedLoads[4].date,
    load5_country: parsedLoads[4].country,
    load5_city: parsedLoads[4].city,
    load5_address: parsedLoads[4].address,
    load5_company: parsedLoads[4].company,
    load5_postal_code: parsedLoads[4].postal_code,
    load5_number: parsedLoads[4].number,

    // C
    unload_date: trimOrNull('unload_date'),
    unload_country: trimOrNull('unload_country'),
    unload_city: trimOrNull('unload_city'),
    unload_address: trimOrNull('unload_address'),
    unload_company: trimOrNull('unload_company'),
    unload_postal_code: trimOrNull('unload_postal_code'),
    unload_number: trimOrNull('unload_number'),

    // Прочее
    notes: trimOrNull('notes'),
    transport_type: trimOrNull('transport_type'),
    transport_temperature: trimOrNull('transport_temperature'),
    cargo_type: trimOrNull('cargo_type'),
    cargo_quantity: trimOrNull('cargo_quantity'),
    customs_loading: trimOrNull('customs_loading'),
    customs_unloading: trimOrNull('customs_unloading'),
  };
}

async function syncExpense(
  supabase: Awaited<ReturnType<typeof createClient>>,
  subcontractorId: string,
  tripId: string,
  price: number,
  currency: string,
  expenseDate: string,
  description: string
): Promise<void> {
  await supabase
    .from('trip_expenses')
    .delete()
    .eq('subcontractor_id', subcontractorId);

  if (price <= 0) return;

  const amountEur = await toEur(supabase, price, currency, expenseDate);

  const { error } = await supabase.from('trip_expenses').insert([
    {
      trip_id: tripId,
      category: 'contractor',
      amount_eur: amountEur,
      original_amount: price,
      currency,
      liters: null,
      description,
      expense_date: expenseDate,
      subcontractor_id: subcontractorId,
    },
  ]);

  if (error) {
    console.error('[trip_subcontractors] expense insert failed:', error.message);
  }
}

export async function createTripSubcontractor(tripId: string, formData: FormData) {
  const supabase = await createClient();
  const data = parseSubcontractorForm(formData);

  const { data: existing } = await supabase
    .from('trip_subcontractors')
    .select('position')
    .eq('trip_id', tripId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (existing?.position || 0) + 1;

  const { data: created, error } = await supabase
    .from('trip_subcontractors')
    .insert([
      {
        trip_id: tripId,
        contractor_id: data.contractor_id,
        position: nextPosition,
        price_eur: 0,
        original_price: data.price,
        currency: data.currency,
        payment_days: data.payment_days,
        truck_number: data.truck_number,
        driver_name: data.driver_name,
        driver_phone: data.driver_phone,

        load_date: data.load_date,
        load_country: data.load_country,
        load_city: data.load_city,
        load_address: data.load_address,
        load_company: data.load_company,
        load_postal_code: data.load_postal_code,
        load_number: data.load_number,

        load2_date: data.load2_date,
        load2_country: data.load2_country,
        load2_city: data.load2_city,
        load2_address: data.load2_address,
        load2_company: data.load2_company,
        load2_postal_code: data.load2_postal_code,
        load2_number: data.load2_number,

        load3_date: data.load3_date,
        load3_country: data.load3_country,
        load3_city: data.load3_city,
        load3_address: data.load3_address,
        load3_company: data.load3_company,
        load3_postal_code: data.load3_postal_code,
        load3_number: data.load3_number,

        load4_date: data.load4_date,
        load4_country: data.load4_country,
        load4_city: data.load4_city,
        load4_address: data.load4_address,
        load4_company: data.load4_company,
        load4_postal_code: data.load4_postal_code,
        load4_number: data.load4_number,

        load5_date: data.load5_date,
        load5_country: data.load5_country,
        load5_city: data.load5_city,
        load5_address: data.load5_address,
        load5_company: data.load5_company,
        load5_postal_code: data.load5_postal_code,
        load5_number: data.load5_number,

        unload_date: data.unload_date,
        unload_country: data.unload_country,
        unload_city: data.unload_city,
        unload_address: data.unload_address,
        unload_company: data.unload_company,
        unload_postal_code: data.unload_postal_code,
        unload_number: data.unload_number,

        notes: data.notes,
        transport_type: data.transport_type,
        transport_temperature: data.transport_temperature,
        cargo_type: data.cargo_type,
        cargo_quantity: data.cargo_quantity,
        customs_loading: data.customs_loading,
        customs_unloading: data.customs_unloading,
      },
    ])
    .select('id')
    .single();

  if (error || !created) throw new Error(`Ошибка создания: ${error?.message || 'unknown'}`);

  const amountEur = await toEur(
    supabase,
    data.price,
    data.currency,
    data.load_date || new Date().toISOString().split('T')[0]
  );

  await supabase
    .from('trip_subcontractors')
    .update({ price_eur: amountEur })
    .eq('id', created.id);

  const desc = data.driver_name
    ? `Подрядчик (${data.driver_name}${data.truck_number ? ', ' + data.truck_number : ''})`
    : 'Подрядчик на части маршрута';

  await syncExpense(
    supabase,
    created.id,
    tripId,
    data.price,
    data.currency,
    data.load_date || new Date().toISOString().split('T')[0],
    desc
  );

  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    summary: `Добавлен подрядчик на рейс: ${data.price} ${data.currency} (≈ ${Math.round(amountEur * 100) / 100} €)`,
  });

  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/trips');
}

export async function updateTripSubcontractor(
  subcontractorId: string,
  tripId: string,
  formData: FormData
) {
  const supabase = await createClient();
  const data = parseSubcontractorForm(formData);

  const amountEur = await toEur(
    supabase,
    data.price,
    data.currency,
    data.load_date || new Date().toISOString().split('T')[0]
  );

  const { error } = await supabase
    .from('trip_subcontractors')
    .update({
      contractor_id: data.contractor_id,
      price_eur: amountEur,
      original_price: data.price,
      currency: data.currency,
      payment_days: data.payment_days,
      truck_number: data.truck_number,
      driver_name: data.driver_name,
      driver_phone: data.driver_phone,

      load_date: data.load_date,
      load_country: data.load_country,
      load_city: data.load_city,
      load_address: data.load_address,
      load_company: data.load_company,
      load_postal_code: data.load_postal_code,
      load_number: data.load_number,

      load2_date: data.load2_date,
      load2_country: data.load2_country,
      load2_city: data.load2_city,
      load2_address: data.load2_address,
      load2_company: data.load2_company,
      load2_postal_code: data.load2_postal_code,
      load2_number: data.load2_number,

      load3_date: data.load3_date,
      load3_country: data.load3_country,
      load3_city: data.load3_city,
      load3_address: data.load3_address,
      load3_company: data.load3_company,
      load3_postal_code: data.load3_postal_code,
      load3_number: data.load3_number,

      load4_date: data.load4_date,
      load4_country: data.load4_country,
      load4_city: data.load4_city,
      load4_address: data.load4_address,
      load4_company: data.load4_company,
      load4_postal_code: data.load4_postal_code,
      load4_number: data.load4_number,

      load5_date: data.load5_date,
      load5_country: data.load5_country,
      load5_city: data.load5_city,
      load5_address: data.load5_address,
      load5_company: data.load5_company,
      load5_postal_code: data.load5_postal_code,
      load5_number: data.load5_number,

      unload_date: data.unload_date,
      unload_country: data.unload_country,
      unload_city: data.unload_city,
      unload_address: data.unload_address,
      unload_company: data.unload_company,
      unload_postal_code: data.unload_postal_code,
      unload_number: data.unload_number,

      notes: data.notes,
      transport_type: data.transport_type,
      transport_temperature: data.transport_temperature,
      cargo_type: data.cargo_type,
      cargo_quantity: data.cargo_quantity,
      customs_loading: data.customs_loading,
      customs_unloading: data.customs_unloading,
    })
    .eq('id', subcontractorId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);

  const desc = data.driver_name
    ? `Подрядчик (${data.driver_name}${data.truck_number ? ', ' + data.truck_number : ''})`
    : 'Подрядчик на части маршрута';

  await syncExpense(
    supabase,
    subcontractorId,
    tripId,
    data.price,
    data.currency,
    data.load_date || new Date().toISOString().split('T')[0],
    desc
  );

  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    summary: `Подрядчик на рейсе изменён: ${data.price} ${data.currency} (≈ ${Math.round(amountEur * 100) / 100} €)`,
  });

  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/trips');
}

export async function deleteTripSubcontractor(
  subcontractorId: string,
  tripId: string
) {
  const supabase = await createClient();

  const { data: before } = await supabase
    .from('trip_subcontractors')
    .select('original_price, currency, driver_name')
    .eq('id', subcontractorId)
    .maybeSingle();

  await supabase
    .from('trip_expenses')
    .delete()
    .eq('subcontractor_id', subcontractorId);

  const { error } = await supabase
    .from('trip_subcontractors')
    .delete()
    .eq('id', subcontractorId);

  if (error) throw new Error(`Ошибка удаления: ${error.message}`);

  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    summary: before
      ? `Удалён подрядчик на рейсе: ${before.original_price} ${before.currency}${before.driver_name ? ' (' + before.driver_name + ')' : ''}`
      : 'Удалён подрядчик на рейсе',
  });

  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/trips');
}
