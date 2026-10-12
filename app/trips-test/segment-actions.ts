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

  if (executorType === 'contractor' && !contractorId) {
    throw new Error('Выберите подрядчика');
  }

  if (!fromCity && !fromCountry && !toCity && !toCountry) {
    throw new Error('Заполните хотя бы откуда или куда');
  }

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
      notes,
    }])
    .select('id')
    .single();

  if (error || !created) throw new Error(`Ошибка создания сегмента: ${error?.message || 'unknown'}`);

  if (cargoIds.length > 0) {
    const links = cargoIds.map((cid) => ({ segment_id: created.id, cargo_id: cid }));
    const { error: linkErr } = await supabase
      .from('trip_segment_cargo')
      .insert(links);
    if (linkErr) throw new Error(`Ошибка привязки грузов: ${linkErr.message}`);
  }

  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    summary: `Добавлен сегмент №${nextPosition} (${executorType === 'us' ? 'мы' : 'подрядчик'})`,
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

  if (executorType === 'contractor' && !contractorId) {
    throw new Error('Выберите подрядчика');
  }

  if (!fromCity && !fromCountry && !toCity && !toCountry) {
    throw new Error('Заполните хотя бы откуда или куда');
  }

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
      notes,
    })
    .eq('id', segmentId);

  if (error) throw new Error(`Ошибка обновления сегмента: ${error.message}`);

  // Пересоздаём связи с грузами
  await supabase
    .from('trip_segment_cargo')
    .delete()
    .eq('segment_id', segmentId);

  if (cargoIds.length > 0) {
    const links = cargoIds.map((cid) => ({ segment_id: segmentId, cargo_id: cid }));
    const { error: linkErr } = await supabase
      .from('trip_segment_cargo')
      .insert(links);
    if (linkErr) throw new Error(`Ошибка привязки грузов: ${linkErr.message}`);
  }

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

  if (error) throw new Error(`Ошибка удаления сегмента: ${error.message}`);

  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    summary: `Удалён сегмент №${before?.position || '—'}`,
  });

  revalidatePath(`/trips-test/${tripId}`);
  return { success: true };
}
