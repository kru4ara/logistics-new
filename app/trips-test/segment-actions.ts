'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase-server';
import { logAudit } from '../../lib/audit';

function str(formData: FormData, key: string): string | null {
  const v = (formData.get(key) as string)?.trim();
  return v || null;
}

function parseCargoIds(formData: FormData): string[] {
  const ids = formData.getAll('cargo_ids') as string[];
  return ids.filter(Boolean);
}

/**
 * Берёт первый груз из списка и копирует его from/to в сегмент.
 * Нужно для обратной совместимости — старые запросы читают s.from_city и т.п.
 * Но реальный UI рендерит маршрут из привязанных грузов.
 */
async function deriveRouteFromFirstCargo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cargoIds: string[]
): Promise<{
  from_country: string | null;
  from_city: string | null;
  from_company: string | null;
  from_address: string | null;
  from_postal_code: string | null;
  to_country: string | null;
  to_city: string | null;
  to_company: string | null;
  to_address: string | null;
  to_postal_code: string | null;
}> {
  if (cargoIds.length === 0) {
    return {
      from_country: null, from_city: null, from_company: null, from_address: null, from_postal_code: null,
      to_country: null, to_city: null, to_company: null, to_address: null, to_postal_code: null,
    };
  }

  const { data: first } = await supabase
    .from('trip_cargo')
    .select('from_country, from_city, from_company, from_address, from_postal_code, to_country, to_city, to_company, to_address, to_postal_code')
    .eq('id', cargoIds[0])
    .maybeSingle();

  return {
    from_country: first?.from_country || null,
    from_city: first?.from_city || null,
    from_company: first?.from_company || null,
    from_address: first?.from_address || null,
    from_postal_code: first?.from_postal_code || null,
    to_country: first?.to_country || null,
    to_city: first?.to_city || null,
    to_company: first?.to_company || null,
    to_address: first?.to_address || null,
    to_postal_code: first?.to_postal_code || null,
  };
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

  if (executorType === 'contractor' && !contractorId) {
    throw new Error('Выберите подрядчика');
  }

  if (cargoIds.length === 0) {
    throw new Error('Выберите хотя бы один груз для этого участка');
  }

  const route = await deriveRouteFromFirstCargo(supabase, cargoIds);

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
      from_country: route.from_country,
      from_city: route.from_city,
      from_company: route.from_company,
      from_address: route.from_address,
      from_postal_code: route.from_postal_code,
      to_country: route.to_country,
      to_city: route.to_city,
      to_company: route.to_company,
      to_address: route.to_address,
      to_postal_code: route.to_postal_code,
      notes,
    }])
    .select('id')
    .single();

  if (error || !created) throw new Error(`Ошибка создания участка: ${error?.message || 'unknown'}`);

  const links = cargoIds.map((cid) => ({ segment_id: created.id, cargo_id: cid }));
  const { error: linkErr } = await supabase
    .from('trip_segment_cargo')
    .insert(links);
  if (linkErr) throw new Error(`Ошибка привязки грузов: ${linkErr.message}`);

  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    summary: `Добавлен участок №${nextPosition} (${executorType === 'us' ? 'мы' : 'подрядчик'}, грузов: ${cargoIds.length})`,
  });

  revalidatePath(`/trips-test/${tripId}`);
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

  if (executorType === 'contractor' && !contractorId) {
    throw new Error('Выберите подрядчика');
  }

  if (cargoIds.length === 0) {
    throw new Error('Выберите хотя бы один груз для этого участка');
  }

  const route = await deriveRouteFromFirstCargo(supabase, cargoIds);

  const { error } = await supabase
    .from('trip_segments')
    .update({
      executor_type: executorType,
      contractor_id: executorType === 'contractor' ? contractorId : null,
      truck_id: executorType === 'us' ? truckId : null,
      driver_id: executorType === 'us' ? driverId : null,
      date_from: dateFrom,
      date_to: dateTo,
      from_country: route.from_country,
      from_city: route.from_city,
      from_company: route.from_company,
      from_address: route.from_address,
      from_postal_code: route.from_postal_code,
      to_country: route.to_country,
      to_city: route.to_city,
      to_company: route.to_company,
      to_address: route.to_address,
      to_postal_code: route.to_postal_code,
      notes,
    })
    .eq('id', segmentId);

  if (error) throw new Error(`Ошибка обновления участка: ${error.message}`);

  await supabase
    .from('trip_segment_cargo')
    .delete()
    .eq('segment_id', segmentId);

  const links = cargoIds.map((cid) => ({ segment_id: segmentId, cargo_id: cid }));
  const { error: linkErr } = await supabase
    .from('trip_segment_cargo')
    .insert(links);
  if (linkErr) throw new Error(`Ошибка привязки грузов: ${linkErr.message}`);

  revalidatePath(`/trips-test/${tripId}`);
  return { success: true };
}

export async function deleteSegment(segmentId: string, tripId: string) {
  const supabase = await createClient();

  const { data: before } = await supabase
    .from('trip_segments')
    .select('position')
    .eq('id', segmentId)
    .maybeSingle();

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

  revalidatePath(`/trips-test/${tripId}`);
  return { success: true };
}
