'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase-server';
import { logAudit } from '../../lib/audit';

function str(formData: FormData, key: string): string | null {
  const v = (formData.get(key) as string)?.trim();
  return v || null;
}

export async function createCargo(tripId: string, formData: FormData) {
  const supabase = await createClient();

  const label = str(formData, 'label');
  const cargoType = str(formData, 'cargo_type');
  const weightRaw = formData.get('weight_kg') as string;
  const weight = weightRaw ? parseFloat(weightRaw) : null;
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

  const label = str(formData, 'label');
  const cargoType = str(formData, 'cargo_type');
  const weightRaw = formData.get('weight_kg') as string;
  const weight = weightRaw ? parseFloat(weightRaw) : null;
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

  if (!label) throw new Error('Укажите название груза');

  const { error } = await supabase
    .from('trip_cargo')
    .update({
      label,
      cargo_type: cargoType,
      weight_kg: weight,
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
