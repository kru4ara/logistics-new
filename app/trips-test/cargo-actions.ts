'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase-server';
import { logAudit } from '../../lib/audit';

export async function createCargo(tripId: string, formData: FormData) {
  const supabase = await createClient();

  const label = (formData.get('label') as string)?.trim() || null;
  const cargoType = (formData.get('cargo_type') as string)?.trim() || null;
  const weightRaw = formData.get('weight_kg') as string;
  const weight = weightRaw ? parseFloat(weightRaw) : null;
  const clientId = (formData.get('client_id') as string) || null;
  const notes = (formData.get('notes') as string)?.trim() || null;

  if (!label) {
    throw new Error('Укажите название груза');
  }

  // Последняя позиция
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
      client_id: clientId,
      notes,
    }])
    .select('id')
    .single();

  if (error) throw new Error(`Ошибка создания груза: ${error.message}`);

  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    summary: `Добавлен груз «${label}» (позиция ${nextPosition})`,
    changes: { cargo_added: { before: null, after: label } },
  });

  revalidatePath(`/trips-test/${tripId}`);
  return { success: true, id: created?.id };
}

export async function updateCargo(cargoId: string, tripId: string, formData: FormData) {
  const supabase = await createClient();

  const label = (formData.get('label') as string)?.trim() || null;
  const cargoType = (formData.get('cargo_type') as string)?.trim() || null;
  const weightRaw = formData.get('weight_kg') as string;
  const weight = weightRaw ? parseFloat(weightRaw) : null;
  const clientId = (formData.get('client_id') as string) || null;
  const notes = (formData.get('notes') as string)?.trim() || null;

  if (!label) {
    throw new Error('Укажите название груза');
  }

  const { error } = await supabase
    .from('trip_cargo')
    .update({
      label,
      cargo_type: cargoType,
      weight_kg: weight,
      client_id: clientId,
      notes,
    })
    .eq('id', cargoId);

  if (error) throw new Error(`Ошибка обновления груза: ${error.message}`);

  revalidatePath(`/trips-test/${tripId}`);
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

  await logAudit({
    entity_type: 'trip',
    entity_id: tripId,
    action: 'update',
    summary: `Удалён груз «${before?.label || '—'}»`,
    changes: { cargo_deleted: { before: before?.label || '—', after: null } },
  });

  revalidatePath(`/trips-test/${tripId}`);
  return { success: true };
}
