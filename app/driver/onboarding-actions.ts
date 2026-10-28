'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase/admin';
import { getSessionContext } from '../../lib/session';

export async function markDriverOnboarded() {
  const { role, driverId } = await getSessionContext();

  if (role !== 'driver' || !driverId) {
    return { success: false, error: 'Не водитель' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('drivers')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', driverId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/driver');
  return { success: true };
}
