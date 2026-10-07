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
  load_date: string | null;
  unload_date: string | null;
  load_country: string | null;
  load_city: string | null;
  load_address: string | null;
  load_company: string | null;
  load_postal_code: string | null;
  load_number: string | null;
  unload_country: string | null;
  unload_city: string | null;
  unload_address: string | null;
  unload_company: string | null;
  unload_postal_code: string | null;
  unload_number: string | null;
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
  return {
    contractor_id: trimOrNull('contractor_id'),
    price: parseFloat(formData.get('price') as string) || 0,
    currency: (formData.get('currency') as string) || 'EUR',
    payment_days: parseInt(formData.get('payment_days') as string) || 30,
    truck_number: trimOrNull('truck_number'),
    driver_name: trimOrNull('driver_name'),
    driver_phone: trimOrNull('driver_phone'),
    load_date: trimOrNull('load_date'),
    unload_date: trimOrNull('unload_date'),
    load_country: trimOrNull('load_country'),
    load_city: trimOrNull('load_city'),
    load_address: trimOrNull('load_address'),
    load_company: trimOrNull('load_company'),
    load_postal_code: trimOrNull('load_postal_code'),
    load_number: trimOrNull('load_number'),
    unload_country: trimOrNull('unload_country'),
    unload_city: trimOrNull('unload_city'),
    unload_address: trimOrNull('unload_address'),
    unload_company: trimOrNull('unload_company'),
    unload_postal_code: trimOrNull('unload_postal_code'),
    unload_number: trimOrNull('unload_number'),
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
        unload_date: data.unload_date,
        load_country: data.load_country,
        load_city: data.load_city,
        load_address: data.load_address,
        load_company: data.load_company,
        load_postal_code: data.load_postal_code,
        load_number: data.load_number,
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
      unload_date: data.unload_date,
      load_country: data.load_country,
      load_city: data.load_city,
      load_address: data.load_address,
      load_company: data.load_company,
      load_postal_code: data.load_postal_code,
      load_number: data.load_number,
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
