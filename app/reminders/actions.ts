'use server';

import { createClient } from '../../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function deleteReminder(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('reminders').delete().eq('id', id);
  if (error) throw new Error(`Ошибка удаления: ${error.message}`);
  revalidatePath('/reminders');
}

export async function markReminderDone(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('reminders')
    .update({ status: 'done' })
    .eq('id', id);
  if (error) throw new Error(`Ошибка: ${error.message}`);
  revalidatePath('/reminders');
}

export async function reopenReminder(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('reminders')
    .update({ status: 'active' })
    .eq('id', id);
  if (error) throw new Error(`Ошибка: ${error.message}`);
  revalidatePath('/reminders');
}

export async function updateReminder(id: string, formData: FormData) {
  const supabase = await createClient();

  const title = formData.get('title') as string;
  const category = formData.get('category') as string;
  const dueDate = formData.get('due_date') as string;
  const amount = parseFloat(formData.get('amount') as string) || 0;

  const { error } = await supabase
    .from('reminders')
    .update({
      title,
      category,
      due_date: dueDate,
      amount: amount || null,
    })
    .eq('id', id);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);
  revalidatePath('/reminders');
  redirect('/reminders');
}

export async function createReminder(formData: FormData) {
  const supabase = await createClient();

  const title = formData.get('title') as string;
  const category = formData.get('category') as string;
  const dueDate = formData.get('due_date') as string;
  const amount = parseFloat(formData.get('amount') as string) || 0;

  const { error } = await supabase
    .from('reminders')
    .insert([
      {
        title,
        category,
        due_date: dueDate,
        amount: amount || null,
        status: 'active',
        entity_type: null,
        entity_id: null,
      },
    ]);

  if (error) throw new Error(`Ошибка добавления: ${error.message}`);
  revalidatePath('/reminders');
  redirect('/reminders');
}
