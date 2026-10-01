'use server';

import { createClient } from '../../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// ============================================================
// Парсинг формы
// ============================================================
function parseLocationForm(formData: FormData) {
  return {
    name: (formData.get('name') as string)?.trim() || '',
    type: (formData.get('type') as string) || 'both',
    country: (formData.get('country') as string)?.trim() || null,
    company_name: (formData.get('company_name') as string)?.trim() || null,
    postal_code: (formData.get('postal_code') as string)?.trim() || null,
    city: (formData.get('city') as string)?.trim() || null,
    address: (formData.get('address') as string)?.trim() || null,
    contact_person: (formData.get('contact_person') as string)?.trim() || null,
  };
}

// ============================================================
// СОЗДАНИЕ
// ============================================================
export async function createLocation(formData: FormData) {
  const supabase = await createClient();

  const data = parseLocationForm(formData);
  if (!data.name) throw new Error('Название обязательно');

  const { error } = await supabase.from('locations').insert([data]);

  if (error) throw new Error(`Ошибка добавления: ${error.message}`);
  revalidatePath('/locations');
  redirect('/locations?toast=location_created');
}

// ============================================================
// ОБНОВЛЕНИЕ
// ============================================================
export async function updateLocation(locationId: string, formData: FormData) {
  const supabase = await createClient();

  const data = parseLocationForm(formData);
  if (!data.name) throw new Error('Название обязательно');

  const { error } = await supabase
    .from('locations')
    .update(data)
    .eq('id', locationId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);
  revalidatePath('/locations');
  redirect('/locations?toast=location_updated');
}

// ============================================================
// УДАЛЕНИЕ
// ============================================================
export async function deleteLocation(locationId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('locations')
    .delete()
    .eq('id', locationId);

  if (error) throw new Error(`Ошибка удаления: ${error.message}`);
  revalidatePath('/locations');
  redirect('/locations?toast=location_deleted');
}
