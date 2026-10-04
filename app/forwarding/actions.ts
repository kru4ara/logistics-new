'use server';

import { createClient } from '../../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logAudit, diffFields } from '../../lib/audit';

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
// Номер заявки по дате первой погрузки
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
// Парсинг подрядчиков
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
// Парсинг точек
// ============================================================
type ParsedPoint = {
  type: 'loading' | 'unloading';
  sequence: number;
  location_id: string | null;
  date: string | null;
  loading_number: string | null;
  notes: string | null;
};

function parsePoints(formData: FormData, type: 'loading' | 'unloading'): ParsedPoint[] {
  const indices = new Set<number>();
  Array.from(formData.keys()).forEach((key) => {
    const m = key.match(new RegExp(`^${type}_(\\d+)_location_id$`));
    if (m) indices.add(parseInt(m[1]));
  });

  const sorted = Array.from(indices).sort((a, b) => a - b);
  const result: ParsedPoint[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const idx = sorted[i];
    const locId = (formData.get(`${type}_${idx}_location_id`) as string) || '';
    if (!locId) continue;

    result.push({
      type,
      sequence: result.length + 1,
      location_id: locId,
      date: (formData.get(`${type}_${idx}_date`) as string) || null,
      loading_number: (formData.get(`${type}_${idx}_loading_number`) as string)?.trim() || null,
      notes: (formData.get(`${type}_${idx}_notes`) as string)?.trim() || null,
    });
  }

  return result;
}

async function savePoints(
  supabase: Awaited<ReturnType<typeof createClient>>,
  forwardingId: string,
  points: ParsedPoint[]
) {
  await supabase
    .from('forwarding_points')
    .delete()
    .eq('forwarding_id', forwardingId);

  if (points.length === 0) return;

  const rows = points.map((p) => ({
    forwarding_id: forwardingId,
    type: p.type,
    sequence: p.sequence,
    location_id: p.location_id,
    date: p.date,
    loading_number: p.loading_number,
    notes: p.notes,
  }));

  const { error } = await supabase
    .from('forwarding_points')
    .insert(rows);

  if (error) throw new Error(`Ошибка сохранения точек: ${error.message}`);
}

// ============================================================
// Поля для audit
// ============================================================
const FORWARDING_TRACKED_FIELDS = [
  'client_id',
  'client_price_eur',
  'original_currency',
  'original_client_price',
  'load_date',
  'unload_date',
  'status',
  'client_request_number',
  'cargo_description',
  'transport_type',
  'transport_temperature',
  'cargo_type',
  'cargo_quantity',
  'customs_loading',
  'customs_unloading',
] as const;

const FORWARDING_STATUS_LABELS: Record<string, string> = {
  planned: 'Планируется',
  active: 'В пути',
  completed: 'Завершена',
  invoiced: 'Выставлен счёт',
  paid: 'Оплачена',
};

function fmtDateRu(d: string | null | undefined): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('ru-RU');
  } catch {
    return d;
  }
}

// ============================================================
// СОЗДАНИЕ
// ============================================================
export async function createForwarding(formData: FormData) {
  const supabase = await createClient();

  const clientId = formData.get('client_id') as string;
  const currency = (formData.get('currency') as string) || 'EUR';
  const clientPrice = parseFloat(formData.get('client_price') as string) || 0;
  const cargoDescription = (formData.get('cargo_description') as string)?.trim() || null;
  const notes = (formData.get('notes') as string)?.trim() || null;
  const status = (formData.get('status') as string) || 'planned';

  const clientRequestNumber = (formData.get('client_request_number') as string)?.trim() || null;
  const clientRequestDate = (formData.get('client_request_date') as string) || null;

  const transportType = (formData.get('transport_type') as string)?.trim() || null;
  const transportTemperature = (formData.get('transport_temperature') as string)?.trim() || null;
  const cargoType = (formData.get('cargo_type') as string)?.trim() || null;
  const cargoQuantity = (formData.get('cargo_quantity') as string)?.trim() || null;
  const customsLoading = (formData.get('customs_loading') as string)?.trim() || null;
  const customsUnloading = (formData.get('customs_unloading') as string)?.trim() || null;

  const contractors = parseContractors(formData);
  const loadingPoints = parsePoints(formData, 'loading');
  const unloadingPoints = parsePoints(formData, 'unloading');

  if (loadingPoints.length === 0) {
    throw new Error('Добавьте хотя бы одну точку погрузки');
  }

  const firstLoadDate = loadingPoints[0]?.date || new Date().toISOString().split('T')[0];
  const clientPriceEur = await toEur(supabase, clientPrice, currency, firstLoadDate);

  const orderNumber = await findNumberForDate(supabase, firstLoadDate);

  const { data: existing } = await supabase
    .from('forwarding_orders')
    .select('id')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (existing) {
    await shiftNumbersFrom(supabase, orderNumber);
  }

  const loadDate = firstLoadDate;
  const unloadDate = unloadingPoints[unloadingPoints.length - 1]?.date || null;

  const { data: created, error } = await supabase
    .from('forwarding_orders')
    .insert([{
      order_number: orderNumber,
      client_id: clientId || null,
      client_price_eur: clientPriceEur,
      original_currency: currency,
      original_client_price: clientPrice,
      route_from: null,
      route_to: null,
      load_date: loadDate,
      unload_date: unloadDate,
      cargo_description: cargoDescription,
      status,
      notes,
      client_request_number: clientRequestNumber,
      client_request_date: clientRequestDate,
      transport_type: transportType,
      transport_temperature: transportTemperature,
      cargo_type: cargoType,
      cargo_quantity: cargoQuantity,
      customs_loading: customsLoading,
      customs_unloading: customsUnloading,
      loading_reference: null,
    }])
    .select('id')
    .single();

  if (error || !created) throw new Error(`Ошибка создания: ${error?.message || 'unknown'}`);

  await saveContractors(supabase, created.id, contractors, firstLoadDate);
  await savePoints(supabase, created.id, [...loadingPoints, ...unloadingPoints]);

  // Audit
  let clientName = '';
  if (clientId) {
    const { data: cl } = await supabase
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .maybeSingle();
    clientName = cl?.name || '';
  }

  const unloadPart = unloadDate ? ` · до ${fmtDateRu(unloadDate)}` : '';

  await logAudit({
    entity_type: 'forwarding_order',
    entity_id: created.id,
    action: 'create',
    summary: `Создана заявка #${orderNumber}${clientName ? ' · ' + clientName : ''}${unloadPart}`,
  });

  revalidatePath('/forwarding');
  revalidatePath('/statistics');
  revalidatePath('/');
  redirect('/forwarding?toast=forwarding_created');
}

// ============================================================
// ОБНОВЛЕНИЕ
// ============================================================
export async function updateForwarding(orderId: string, formData: FormData) {
  const supabase = await createClient();

  const clientId = formData.get('client_id') as string;
  const currency = (formData.get('currency') as string) || 'EUR';
  const clientPrice = parseFloat(formData.get('client_price') as string) || 0;
  const cargoDescription = (formData.get('cargo_description') as string)?.trim() || null;
  const notes = (formData.get('notes') as string)?.trim() || null;
  const status = (formData.get('status') as string) || 'planned';

  const clientRequestNumber = (formData.get('client_request_number') as string)?.trim() || null;
  const clientRequestDate = (formData.get('client_request_date') as string) || null;

  const transportType = (formData.get('transport_type') as string)?.trim() || null;
  const transportTemperature = (formData.get('transport_temperature') as string)?.trim() || null;
  const cargoType = (formData.get('cargo_type') as string)?.trim() || null;
  const cargoQuantity = (formData.get('cargo_quantity') as string)?.trim() || null;
  const customsLoading = (formData.get('customs_loading') as string)?.trim() || null;
  const customsUnloading = (formData.get('customs_unloading') as string)?.trim() || null;

  const contractors = parseContractors(formData);
  const loadingPoints = parsePoints(formData, 'loading');
  const unloadingPoints = parsePoints(formData, 'unloading');

  if (loadingPoints.length === 0) {
    throw new Error('Добавьте хотя бы одну точку погрузки');
  }

  const firstLoadDate = loadingPoints[0]?.date || new Date().toISOString().split('T')[0];
  const clientPriceEur = await toEur(supabase, clientPrice, currency, firstLoadDate);

  const loadDate = firstLoadDate;
  const unloadDate = unloadingPoints[unloadingPoints.length - 1]?.date || null;

  const { data: before } = await supabase
    .from('forwarding_orders')
    .select('order_number, client_id, client_price_eur, original_currency, original_client_price, load_date, unload_date, status, client_request_number, cargo_description, transport_type, transport_temperature, cargo_type, cargo_quantity, customs_loading, customs_unloading')
    .eq('id', orderId)
    .maybeSingle();

  const { error } = await supabase
    .from('forwarding_orders')
    .update({
      client_id: clientId || null,
      client_price_eur: clientPriceEur,
      original_currency: currency,
      original_client_price: clientPrice,
      route_from: null,
      route_to: null,
      load_date: loadDate,
      unload_date: unloadDate,
      cargo_description: cargoDescription,
      status,
      notes,
      client_request_number: clientRequestNumber,
      client_request_date: clientRequestDate,
      transport_type: transportType,
      transport_temperature: transportTemperature,
      cargo_type: cargoType,
      cargo_quantity: cargoQuantity,
      customs_loading: customsLoading,
      customs_unloading: customsUnloading,
      loading_reference: null,
    })
    .eq('id', orderId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);

  await saveContractors(supabase, orderId, contractors, firstLoadDate);
  await savePoints(supabase, orderId, [...loadingPoints, ...unloadingPoints]);

  // Audit
  if (before) {
    const changes = diffFields(
      before as Record<string, unknown>,
      {
        client_id: clientId || null,
        client_price_eur: clientPriceEur,
        original_currency: currency,
        original_client_price: clientPrice,
        load_date: loadDate,
        unload_date: unloadDate,
        status,
        client_request_number: clientRequestNumber,
        cargo_description: cargoDescription,
        transport_type: transportType,
        transport_temperature: transportTemperature,
        cargo_type: cargoType,
        cargo_quantity: cargoQuantity,
        customs_loading: customsLoading,
        customs_unloading: customsUnloading,
      } as Record<string, unknown>,
      [...FORWARDING_TRACKED_FIELDS]
    );

    const changedCount = Object.keys(changes).length;
    if (changedCount > 0) {
      await logAudit({
        entity_type: 'forwarding_order',
        entity_id: orderId,
        action: 'update',
        summary: `Заявка #${before.order_number || '—'}: изменено ${changedCount} ${changedCount === 1 ? 'поле' : 'полей'}`,
        changes,
      });
    }
  }

  revalidatePath('/forwarding');
  revalidatePath(`/forwarding/${orderId}`);
  revalidatePath('/statistics');
  revalidatePath('/');
  redirect(`/forwarding/${orderId}?toast=forwarding_updated`);
}

// ============================================================
// УДАЛЕНИЕ
// ============================================================
export async function deleteForwarding(orderId: string) {
  const supabase = await createClient();

  const { data: before } = await supabase
    .from('forwarding_orders')
    .select('order_number, client_price_eur, original_currency')
    .eq('id', orderId)
    .maybeSingle();

  const { error } = await supabase
    .from('forwarding_orders')
    .delete()
    .eq('id', orderId);

  if (error) throw new Error(`Ошибка удаления: ${error.message}`);

  await logAudit({
    entity_type: 'forwarding_order',
    entity_id: orderId,
    action: 'delete',
    summary: before
      ? `Удалена заявка #${before.order_number || '—'} (${before.client_price_eur || 0} €)`
      : 'Удалена заявка',
  });

  revalidatePath('/forwarding');
  revalidatePath('/statistics');
  revalidatePath('/');
  redirect('/forwarding?toast=forwarding_deleted');
}

// ============================================================
// СМЕНА СТАТУСА
// ============================================================
export async function setForwardingStatus(orderId: string, status: string) {
  const supabase = await createClient();

  const { data: before } = await supabase
    .from('forwarding_orders')
    .select('order_number, status')
    .eq('id', orderId)
    .maybeSingle();

  const oldStatus = before?.status || null;

  const { error } = await supabase
    .from('forwarding_orders')
    .update({ status })
    .eq('id', orderId);

  if (error) throw new Error(`Ошибка смены статуса: ${error.message}`);

  if (before && oldStatus !== status) {
    const fromLabel = FORWARDING_STATUS_LABELS[oldStatus || ''] || oldStatus || '—';
    const toLabel = FORWARDING_STATUS_LABELS[status] || status;

    await logAudit({
      entity_type: 'forwarding_order',
      entity_id: orderId,
      action: 'status_change',
      summary: `Заявка #${before.order_number || '—'}: статус «${fromLabel}» → «${toLabel}»`,
      changes: {
        status: { before: oldStatus, after: status },
      },
    });
  }

  revalidatePath('/forwarding');
  revalidatePath(`/forwarding/${orderId}`);
}
