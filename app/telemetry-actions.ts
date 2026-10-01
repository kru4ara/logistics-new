'use server';

import { createClient } from '../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function saveTelemetry(tripId: string, km: number, liters: number) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('trips')
    .update({
      actual_km: km,
      actual_liters: liters,
    })
    .eq('id', tripId);

  if (error) {
    throw new Error(`Ошибка сохранения данных: ${error.message}`);
  }

  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}?toast=telemetry_saved`);
}
