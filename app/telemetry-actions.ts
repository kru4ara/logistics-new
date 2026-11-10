'use server';

import { requireOffice } from '../lib/require-office';
import { createClient } from '../lib/supabase/admin'; // <-- исправлено
import { revalidatePath } from 'next/cache';

export async function saveTelemetry(tripId: string, km: number, liters: number) {
  await requireOffice();
  const supabase = await createClient();

  const { error } = await supabase
    .from('trips')
    .update({
      actual_km: km,
      actual_liters: liters,
    })
    .eq('id', tripId);

  if (error) throw new Error(error.message);

  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/trips');
  revalidatePath('/driver');
}

// Серверное действие для формы телеметрии
export async function handleSaveTelemetry(tripId: string, formData: FormData) {
  await requireOffice();
  const km = parseFloat(formData.get('km') as string) || 0;
  const liters = parseFloat(formData.get('liters') as string) || 0;
  await saveTelemetry(tripId, km, liters);
}
