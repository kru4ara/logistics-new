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
// Поиск свободного номера заявки
// ============================================================
async function findFreeNumber(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<number> {
  const { data } = await supabase
    .from('forwarding_orders')
    .select('order_number')
    .not('order_number', 'is', null);

  const used = new Set<number>(
    (data || []).map((r) => r.order_number).filter((n) => n !== null)
  );
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

// ============================================================
// Парсинг подрядчиков из formData
// Ключи: contractor_0_id, contractor_0_price, contractor_0_currency
// ============================================================
type ParsedContractor = {
  contractor_id: string;
  price: number;
  currency: string;
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
    const price = parseFloat(formData.get(`contractor_${i}_price`) as string) || 0;
    const currency = (formData.get(`contractor_${i}_currency`) as string) || 'EUR';

    if (!cid) continue;
    result.push({ contractor_id: cid, price, currency });
  }

  return result;
}

// ============================================================
// СОХРАНЕНИЕ подрядчиков в БД
// ============================================================
async function saveContractors(
  supabase: Awaited<ReturnType<typeof createClient>>,
  forwardingId: string,
  contractors: ParsedContractor[],
  dateForRate: string
) {
  // Удаляем старые
  await supabase
    .from('forwarding_contractors')
    .delete()
    .eq('forwarding_id', forwardingId);

  if (contractors.length === 0) return;

  // Готовим записи
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

  const contractors = parseContractors(formData);

  const dateForRate = loadDate || new Date().toISOString().split('T')[0];

  const clientPriceEur = await toEur(supabase, clientPrice, currency, dateForRate);
  const orderNumber = await findFreeNumber(supabase);

  const { data: created, error } = await supabase
    .from('forwarding_orders')
    .insert([{
      order_number: orderNumber,
      client_id: clientId || null,
      contractor_id: null, // больше не используется
      client_price_eur: clientPriceEur,
      contractor_price_eur: 0, // устаревшее, оставляем 0
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
    }])
    .select('id')
    .single();

  if (error || !created) throw new Error(`Ошибка создания: ${error?.message || 'unknown'}`);

  // Сохраняем подрядчиков
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
    })
    .eq('id', orderId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);

  // Пересохраняем подрядчиков
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
