'use server';

import { createClient } from '../../lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { getActorContext } from '../../lib/driver-access';
import { getT } from '../../lib/i18n/server';

export async function createReminderFromDriver(driverId: string, title: string, dueDate: string) {
  const { t } = await getT();
  const actor = await getActorContext();

  if (!actor.isDriver || !actor.driverId) {
    return { success: false, error: t('common.noAccess') };
  }

  // driverId берём ИЗ СЕССИИ, а не из аргумента: иначе водитель мог
  // создать напоминание для чужого водителя.
  if (driverId !== actor.driverId) {
    return { success: false, error: t('common.noAccess') };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('reminders')
    .insert([
      {
        title: title,
        category: 'driver_doc',
        due_date: dueDate,
        entity_type: 'driver',
        entity_id: actor.driverId,
        status: 'active'
      }
    ]);

  if (error) {
    throw new Error(t('dir.addError', { msg: error.message }));
  }

  revalidatePath('/reminders');
  return { success: true };
}
