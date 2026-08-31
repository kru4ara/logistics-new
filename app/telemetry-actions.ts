'use server';

import { supabase } from '../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

export async function saveTelemetry(tripId: string, km: number, liters: number) {
  const { error } = await supabase
    .from('trips')
    .update({
      actual_km: km,
      actual_liters: liters
    })
    .eq('id', tripId);

  if (error) {
    throw new Error(`Ошибка сохранения данных: ${error.message}`);
  }

  revalidatePath(`/trips/${tripId}`);
}
