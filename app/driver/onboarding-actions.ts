'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../lib/supabase/admin';
import { getSessionContext } from '../../lib/session';
import { isDriverRole } from '../../lib/roles';
import { getT } from '../../lib/i18n/server';

export async function markDriverOnboarded() {
  const { t } = await getT();
  const { role, driverId } = await getSessionContext();

  if (!isDriverRole(role) || !driverId) {
    return { success: false, error: t('drvApp.notDriver') };
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
