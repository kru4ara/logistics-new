'use server';

import { createClient } from '../../lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { getActorContext } from '../../lib/driver-access';

export async function createReminderFromDriver(driverId: string, title: string, dueDate: string) {
  const actor = await getActorContext();

  if (!actor.isDriver || !actor.driverId) {
    return { success: false, error: 'Нет доступа' };
  }

  // driverId берём ИЗ СЕССИИ, а не из аргумента: иначе водитель мог
  // создать напоминание для чужого водителя.
  if (driverId !== actor.driverId) {
    return { success: false, error: 'Нет доступа' };
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
    throw new Error(`Ошибка добавления: ${error.message}`);
  }

  revalidatePath('/reminders');
  return { success: true };
}
