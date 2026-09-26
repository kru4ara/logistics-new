'use server';

import { createClient } from '../../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

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
// Поиск номера для новой заявки по её дате загрузки
// ============================================================
async function findNumberForDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  loadDate: string
): Promise<number> {
  const { count: earlier } = await supabase
    .from('forwarding_orders')
    .select('*', { count: 'exact', head: true })
    .lt('load_date', loadDate);

  const { count: sameDate } = await supabase
    .from('forwarding_orders')
    .select('*', { count: 'exact', head: true })
    .eq('load_date', loadDate);

  return (earlier || 0) + (sameDate || 0) + 1;
}

async function shiftNumbersFrom(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fromNumber: number
) {
  const { data: toShift } = await supabase
    .from('forwarding_orders')
    .select('id, order_number')
    .gte('order_number', fromNumber)
    .order('order_number', { ascending: false });

  if (!toShift || toShift.length === 0) return;

  for (const row of toShift) {
    await supabase
      .from('forwarding_orders')
      .update({ order_number: (row.order_number || 0) + 1 })
      .eq('id', row.id);
  }
}

// ============================================================
// Парсинг подрядчиков из formData
// ============================================================
type ParsedContractor = {
  contractor_id: string;
  price: number;
  currency: string;
  truck_number: string | null;
  driver_name: string | null;
  payment_days: number;
  notes: string | null;
};

function parseContractors(formData: FormData): ParsedContractor[] {
  const indices = new Set<number>();
  Array.from(formData.keys()).forEach((key) => {
    const m = key.match(/^contractor_(\d+)_id$/);
    if (m) indices.add(parseInt(m[1]));
  });

  const sorted = Array.from(indices).sort((a, b) => a - b);
  const result: ParsedContractor[] = [];

  for (const i of sorted) {
    const cid = (formData.get(`contractor_${i}_id`) as string) || '';
    if (!cid) continue;

    result.push({
      contractor_id: cid,
      price: parseFloat(formData.get(`contractor_${i}_price`) as string) || 0,
      currency: (formData.get(`contractor_${i}_currency`) as string) || 'EUR',
      truck_number: (formData.get(`contractor_${i}_truck_number`) as string)?.trim() || null,
      driver_name: (formData.get(`contractor_${i}_driver_name`) as string)?.trim() || null,
      payment_days: parseInt(formData.get(`contractor_${i}_payment_days`) as string) || 30,
      notes: (formData.get(`contractor_${i}_notes`) as string)?.trim() || null,
    });
  }

  return result;
}

async function saveContractors(
  supabase: Awaited<ReturnType<typeof createClient>>,
  forwardingId: string,
  contractors: ParsedContractor[],
  dateForRate: string
) {
  await supabase
    .from('forwarding_contractors')
    .delete()
    .eq('forwarding_id', forwardingId);

  if (contractors.length === 0) return;

  const rows = [];
  for (let i = 0; i < contractors.length; i++) {
    const c = contractors[i];
    const priceEur = await toEur(supabase, c.price, c.currency, dateForRate);
    rows.push({
      forwarding_id: forwardingId,
      contractor_id: c.contractor_id,
      price_eur: priceEur,
      original_price: c.price,
      currency: c.currency,
      position: i + 1,
      truck_number: c.truck_number,
      driver_name: c.driver_name,
      payment_days: c.payment_days,
      notes: c.notes,
    });
  }

  const { error } = await supabase
    .from('forwarding_contractors')
    .insert(rows);

  if (error) throw new Error(`Ошибка сохранения подрядчиков: ${error.message}`);
}

// ============================================================
// СОЗДАНИЕ заявки
// ============================================================
export async function createForwarding(formData: FormData) {
  const supabase = await createClient();

  const clientId = formData.get('client_id') as string;
  const currency = (formData.get('currency') as string) || 'EUR';
  const clientPrice = parseFloat(formData.get('client_price') as string) || 0;
  const routeFrom = (formData.get('route_from') as string)?.trim() || null;
  const routeTo = (formData.get('route_to') as string)?.trim() || null;
  const loadDate = (formData.get('load_date') as string) || null;
  const unloadDate = (formData.get('unload_date') as string) || null;
  const cargoDescription = (formData.get('cargo_description') as string)?.trim() || null;
  const notes = (formData.get('notes') as string)?.trim() || null;
  const status = (formData.get('status') as string) || 'planned';

  const clientRequestNumber = (formData.get('client_request_number') as string)?.trim() || null;
  const clientRequestDate = (formData.get('client_request_date') as string) || null;

  // НОВЫЕ ПОЛЯ
  const transportType = (formData.get('transport_type') as string)?.trim() || null;
  const cargoType = (formData.get('cargo_type') as string)?.trim() || null;
  const cargoQuantity = (formData.get('cargo_quantity') as string)?.trim() || null;
  const customsLoading = (formData.get('customs_loading') as string)?.trim() || null;
  const customsUnloading = (formData.get('customs_unloading') as string)?.trim() || null;
  const loadingReference = (formData.get('loading_reference') as string)?.trim() || null;

  const contractors = parseContractors(formData);

  const dateForRate = loadDate || new Date().toISOString().split('T')[0];
  const clientPriceEur = await toEur(supabase, clientPrice, currency, dateForRate);

  // Номер по дате загрузки
  let orderNumber = 1;
  if (loadDate) {
    orderNumber = await findNumberForDate(supabase, loadDate);

    const { data: existing } = await supabase
      .from('forwarding_orders')
      .select('id')
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (existing) {
      await shiftNumbersFrom(supabase, orderNumber);
    }
  }

  const { data: created, error } = await supabase
    .from('forwarding_orders')
    .insert([{
      order_number: orderNumber,
      client_id: clientId || null,
      contractor_id: null,
      client_price_eur: clientPriceEur,
      contractor_price_eur: 0,
      original_currency: currency,
      original_client_price: clientPrice,
      original_contractor_price: 0,
      route_from: routeFrom,
      route_to: routeTo,
      load_date: loadDate,
      unload_date: unloadDate,
      cargo_description: cargoDescription,
      status,
      notes,
      client_request_number: clientRequestNumber,
      client_request_date: clientRequestDate,
      transport_type: transportType,
      cargo_type: cargoType,
      cargo_quantity: cargoQuantity,
      customs_loading: customsLoading,
      customs_unloading: customsUnloading,
      loading_reference: loadingReference,
    }])
    .select('id')
    .single();

  if (error || !created) throw new Error(`Ошибка создания: ${error?.message || 'unknown'}`);

  await saveContractors(supabase, created.id, contractors, dateForRate);

  revalidatePath('/forwarding');
  revalidatePath('/statistics');
  revalidatePath('/');
  redirect('/forwarding');
}

// ============================================================
// ОБНОВЛЕНИЕ заявки
// ============================================================
export async function updateForwarding(orderId: string, formData: FormData) {
  const supabase = await createClient();

  const clientId = formData.get('client_id') as string;
  const currency = (formData.get('currency') as string) || 'EUR';
  const clientPrice = parseFloat(formData.get('client_price') as string) || 0;
  const routeFrom = (formData.get('route_from') as string)?.trim() || null;
  const routeTo = (formData.get('route_to') as string)?.trim() || null;
  const loadDate = (formData.get('load_date') as string) || null;
  const unloadDate = (formData.get('unload_date') as string) || null;
  const cargoDescription = (formData.get('cargo_description') as string)?.trim() || null;
  const notes = (formData.get('notes') as string)?.trim() || null;
  const status = (formData.get('status') as string) || 'planned';

  const clientRequestNumber = (formData.get('client_request_number') as string)?.trim() || null;
  const clientRequestDate = (formData.get('client_request_date') as string) || null;

  // НОВЫЕ ПОЛЯ
  const transportType = (formData.get('transport_type') as string)?.trim() || null;
  const cargoType = (formData.get('cargo_type') as string)?.trim() || null;
  const cargoQuantity = (formData.get('cargo_quantity') as string)?.trim() || null;
  const customsLoading = (formData.get('customs_loading') as string)?.trim() || null;
  const customsUnloading = (formData.get('customs_unloading') as string)?.trim() || null;
  const loadingReference = (formData.get('loading_reference') as string)?.trim() || null;

  const contractors = parseContractors(formData);

  const dateForRate = loadDate || new Date().toISOString().split('T')[0];
  const clientPriceEur = await toEur(supabase, clientPrice, currency, dateForRate);

  const { error } = await supabase
    .from('forwarding_orders')
    .update({
      client_id: clientId || null,
      client_price_eur: clientPriceEur,
      original_currency: currency,
      original_client_price: clientPrice,
      route_from: routeFrom,
      route_to: routeTo,
      load_date: loadDate,
      unload_date: unloadDate,
      cargo_description: cargoDescription,
      status,
      notes,
      client_request_number: clientRequestNumber,
      client_request_date: clientRequestDate,
      transport_type: transportType,
      cargo_type: cargoType,
      cargo_quantity: cargoQuantity,
      customs_loading: customsLoading,
      customs_unloading: customsUnloading,
      loading_reference: loadingReference,
    })
    .eq('id', orderId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);

  await saveContractors(supabase, orderId, contractors, dateForRate);

  revalidatePath('/forwarding');
  revalidatePath(`/forwarding/${orderId}`);
  revalidatePath('/statistics');
  revalidatePath('/');
  redirect(`/forwarding/${orderId}`);
}

// ============================================================
// УДАЛЕНИЕ заявки
// ============================================================
export async function deleteForwarding(orderId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('forwarding_orders')
    .delete()
    .eq('id', orderId);

  if (error) throw new Error(`Ошибка удаления: ${error.message}`);
  revalidatePath('/forwarding');
  revalidatePath('/statistics');
  revalidatePath('/');
  redirect('/forwarding');
}

// ============================================================
// СМЕНА СТАТУСА
// ============================================================
export async function setForwardingStatus(orderId: string, status: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('forwarding_orders')
    .update({ status })
    .eq('id', orderId);

  if (error) throw new Error(`Ошибка смены статуса: ${error.message}`);
  revalidatePath('/forwarding');
  revalidatePath(`/forwarding/${orderId}`);
}
