'use server';

import { supabase } from '../../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

export async function createReminderFromDriver(driverId: string, title: string, dueDate: string) {
  const { error } = await supabase
    .from('reminders')
    .insert([
      {
        title: title,
        category: 'driver_doc',
        due_date: dueDate,
        entity_type: 'driver',
        entity_id: driverId,
        status: 'active'
      }
    ]);

  if (error) {
    throw new Error(`Ошибка добавления: ${error.message}`);
  }

  revalidatePath('/reminders');
}
