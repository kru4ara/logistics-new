'use server';

import { createClient } from '../../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logAudit, diffFields } from '../../lib/audit';

const TRACKED_FIELDS = [
  'title', 'category', 'due_date', 'amount', 'status',
] as const;

export async function deleteReminder(id: string) {
  const supabase = await createClient();

  const { data: before } = await supabase
    .from('reminders')
    .select('title, category, due_date')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('reminders').delete().eq('id', id);
  if (error) throw new Error(`Ошибка удаления: ${error.message}`);

  await logAudit({
    entity_type: 'reminder',
    entity_id: id,
    action: 'delete',
    summary: before
      ? `Удалено напоминание «${before.title}»${before.due_date ? ' · срок ' + new Date(before.due_date).toLocaleDateString('ru-RU') : ''}`
      : 'Удалено напоминание',
  });

  revalidatePath('/reminders');
  redirect('/reminders?toast=reminder_deleted');
}

export async function markReminderDone(id: string) {
  const supabase = await createClient();

  const { data: before } = await supabase
    .from('reminders')
    .select('title, status')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('reminders')
    .update({ status: 'done' })
    .eq('id', id);
  if (error) throw new Error(`Ошибка: ${error.message}`);

  if (before && before.status !== 'done') {
    await logAudit({
      entity_type: 'reminder',
      entity_id: id,
      action: 'status_change',
      summary: `Напоминание «${before.title}»: отмечено как выполнено`,
      changes: { status: { before: before.status, after: 'done' } },
    });
  }

  revalidatePath('/reminders');
  redirect('/reminders?toast=reminder_done');
}

export async function reopenReminder(id: string) {
  const supabase = await createClient();

  const { data: before } = await supabase
    .from('reminders')
    .select('title, status')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('reminders')
    .update({ status: 'active' })
    .eq('id', id);
  if (error) throw new Error(`Ошибка: ${error.message}`);

  if (before && before.status !== 'active') {
    await logAudit({
      entity_type: 'reminder',
      entity_id: id,
      action: 'status_change',
      summary: `Напоминание «${before.title}»: возвращено в работу`,
      changes: { status: { before: before.status, after: 'active' } },
    });
  }

  revalidatePath('/reminders');
  redirect('/reminders?toast=reminder_reopened');
}

export async function updateReminder(id: string, formData: FormData) {
  const supabase = await createClient();

  const title = formData.get('title') as string;
  const category = formData.get('category') as string;
  const dueDate = formData.get('due_date') as string;
  const amount = parseFloat(formData.get('amount') as string) || 0;

  const { data: before } = await supabase
    .from('reminders')
    .select('title, category, due_date, amount, status')
    .eq('id', id)
    .maybeSingle();

  const nextValues = {
    title,
    category,
    due_date: dueDate,
    amount: amount || null,
  };

  const { error } = await supabase
    .from('reminders')
    .update(nextValues)
    .eq('id', id);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);

  if (before) {
    const changes = diffFields(
      { ...before, amount: before.amount } as Record<string, unknown>,
      nextValues as Record<string, unknown>,
      ['title', 'category', 'due_date', 'amount']
    );

    const changedCount = Object.keys(changes).length;
    if (changedCount > 0) {
      await logAudit({
        entity_type: 'reminder',
        entity_id: id,
        action: 'update',
        summary: `Напоминание «${before.title}»: изменено ${changedCount} ${changedCount === 1 ? 'поле' : 'полей'}`,
        changes,
      });
    }
  }

  revalidatePath('/reminders');
  redirect('/reminders?toast=reminder_updated');
}

export async function createReminder(formData: FormData) {
  const supabase = await createClient();

  const title = formData.get('title') as string;
  const category = formData.get('category') as string;
  const dueDate = formData.get('due_date') as string;
  const amount = parseFloat(formData.get('amount') as string) || 0;

  const { data: created, error } = await supabase
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
    ])
    .select('id')
    .single();

  if (error) throw new Error(`Ошибка добавления: ${error.message}`);

  if (created?.id) {
    await logAudit({
      entity_type: 'reminder',
      entity_id: created.id,
      action: 'create',
      summary: `Создано напоминание «${title}»${dueDate ? ' · срок ' + new Date(dueDate).toLocaleDateString('ru-RU') : ''}`,
    });
  }

  revalidatePath('/reminders');
  redirect('/reminders?toast=reminder_created');
}
