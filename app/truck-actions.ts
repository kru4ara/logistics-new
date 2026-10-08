'use server';

import { createClient } from '../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { syncReminders } from './reminder-actions';

// ============================================================
// Парсер формы — общий для create и update
// ============================================================
function parseTruckForm(formData: FormData) {
  const trimOrNull = (key: string): string | null => {
    const v = (formData.get(key) as string | null)?.trim();
    return v || null;
  };

  const intOrNull = (key: string): number | null => {
    const v = (formData.get(key) as string | null)?.trim();
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  };

  const rawType = (formData.get('type') as string) || 'tractor';
  const type = rawType === 'trailer' ? 'trailer' : 'tractor';

  return {
    registration_number: trimOrNull('registration_number') || '',
    type,

    brand: trimOrNull('brand'),
    model: trimOrNull('model'),
    year: intOrNull('year'),
    vin: trimOrNull('vin'),

    // Общие документы
    truck_insurance_expiry: trimOrNull('truck_insurance_expiry'),
    tech_inspection_expiry: trimOrNull('tech_inspection_expiry'),
    border_insurance_expiry: trimOrNull('border_insurance_expiry'),

    // Только для тягача
    to_expiry: trimOrNull('to_expiry'),
    tachograph_calibration_expiry: trimOrNull('tachograph_calibration_expiry'),
    fuel_card_number: trimOrNull('fuel_card_number'),
    trailer_number: trimOrNull('trailer_number'),

    // Только для прицепа
    customs_certificate_expiry: trimOrNull('customs_certificate_expiry'),
  };
}

// ============================================================
// Создание транспорта
// ============================================================
export async function createTruck(formData: FormData) {
  const supabase = await createClient();
  const payload = parseTruckForm(formData);

  if (!payload.registration_number) {
    throw new Error('Укажите госномер');
  }

  const { data, error } = await supabase
    .from('trucks')
    .insert([payload])
    .select('id')
    .single();

  if (error) throw new Error(`Ошибка добавления: ${error.message}`);

  // Автогенерация напоминаний по датам
  if (data?.id) {
    await syncReminders('truck', data.id);
  }

  revalidatePath('/trucks');
  revalidatePath('/reminders');
  redirect('/trucks?toast=truck_created');
}

// ============================================================
// Обновление транспорта
// ============================================================
export async function updateTruck(truckId: string, formData: FormData) {
  const supabase = await createClient();
  const payload = parseTruckForm(formData);

  if (!payload.registration_number) {
    throw new Error('Укажите госномер');
  }

  const { error } = await supabase
    .from('trucks')
    .update(payload)
    .eq('id', truckId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);

  await syncReminders('truck', truckId);

  revalidatePath(`/trucks/${truckId}`);
  revalidatePath('/trucks');
  revalidatePath('/reminders');
  redirect(`/trucks/${truckId}?toast=truck_updated`);
}
