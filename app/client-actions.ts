'use server';

import { requireOffice } from '../lib/require-office';
import { createClient } from '../lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logAudit, diffFields } from '../lib/audit';
import { getT } from '../lib/i18n/server';

/** Срок оплаты клиента: пусто → null, иначе целое 0–365 (иначе ошибка). */
function parsePaymentDays(v: FormDataEntryValue | null): number | null | 'bad' {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 365 ? n : 'bad';
}

export async function updateClient(clientId: string, formData: FormData) {
  const { t } = await getT();
  await requireOffice();
  const supabase = await createClient();

  const name = formData.get('name') as string;
  const contactPerson = formData.get('contact_person') as string;
  const phone = formData.get('phone') as string;
  const email = formData.get('email') as string;

  const paymentDays = parsePaymentDays(formData.get('payment_days'));
  if (paymentDays === 'bad') throw new Error(t('recv.badDays'));

  // Берём старые значения для audit
  const { data: before } = await supabase
    .from('clients')
    .select('name, contact_person, phone, email, payment_days')
    .eq('id', clientId)
    .maybeSingle();

  const { error } = await supabase
    .from('clients')
    .update({
      name: name,
      contact_person: contactPerson || null,
      phone: phone || null,
      email: email || null,
      payment_days: paymentDays,
    })
    .eq('id', clientId);

  if (error) throw new Error(t('dir.updateError', { msg: error.message }));

  // Audit: логируем только изменённые поля
  if (before) {
    const changes = diffFields(
      {
        name: before.name,
        contact_person: before.contact_person,
        phone: before.phone,
        email: before.email,
        payment_days: before.payment_days,
      },
      {
        name: name || '',
        contact_person: contactPerson || null,
        phone: phone || null,
        email: email || null,
        payment_days: paymentDays,
      },
      ['name', 'contact_person', 'phone', 'email', 'payment_days']
    );

    const changedCount = Object.keys(changes).length;
    if (changedCount > 0) {
      await logAudit({
        entity_type: 'client',
        entity_id: clientId,
        action: 'update',
        summary: `Клиент «${before.name}»: изменено ${changedCount} ${changedCount === 1 ? 'поле' : 'полей'}`,
        changes,
      });
    }
  }

  revalidatePath('/clients');
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function deleteClient(clientId: string) {
  const { t } = await getT();
  await requireOffice();
  const supabase = await createClient();

  // Запоминаем имя перед удалением
  const { data: before } = await supabase
    .from('clients')
    .select('name')
    .eq('id', clientId)
    .maybeSingle();

  // Сначала отвязываем клиента от рейсов (чтобы не нарушить внешний ключ)
  const { error: unlinkError } = await supabase
    .from('trips')
    .update({ client_id: null })
    .eq('client_id', clientId);
  if (unlinkError) throw new Error(t('dir.unlinkError', { msg: unlinkError.message }));

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId);
  if (error) throw new Error(t('dir.deleteError', { msg: error.message }));

  await logAudit({
    entity_type: 'client',
    entity_id: clientId,
    action: 'delete',
    summary: before ? `Удалён клиент «${before.name}»` : 'Удалён клиент',
  });

  revalidatePath('/clients');
  redirect('/clients');
}

export async function mergeClients(sourceId: string, targetId: string) {
  const { t } = await getT();
  await requireOffice();
  const supabase = await createClient();

  if (sourceId === targetId) {
    throw new Error(t('dir.mergeErrSelf'));
  }

  const { error } = await supabase.rpc('merge_clients', {
    source_id: sourceId,
    target_id: targetId,
  });

  if (error) throw new Error(t('dir.mergeError', { msg: error.message }));

  await logAudit({
    entity_type: 'client',
    entity_id: targetId,
    action: 'merge',
    summary: `Объединён клиент ${sourceId} → ${targetId}`,
  });

  revalidatePath('/clients');
  revalidatePath('/trips');
  redirect('/clients?toast=clients_merged');
}
