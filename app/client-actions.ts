'use server';

import { createClient } from '../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logAudit, diffFields } from '../lib/audit';

export async function updateClient(clientId: string, formData: FormData) {
  const supabase = await createClient();

  const name = formData.get('name') as string;
  const contactPerson = formData.get('contact_person') as string;
  const phone = formData.get('phone') as string;
  const email = formData.get('email') as string;

  // Берём старые значения для audit
  const { data: before } = await supabase
    .from('clients')
    .select('name, contact_person, phone, email')
    .eq('id', clientId)
    .maybeSingle();

  const { error } = await supabase
    .from('clients')
    .update({
      name: name,
      contact_person: contactPerson || null,
      phone: phone || null,
      email: email || null
    })
    .eq('id', clientId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);

  // Audit: логируем только изменённые поля
  if (before) {
    const changes = diffFields(
      {
        name: before.name,
        contact_person: before.contact_person,
        phone: before.phone,
        email: before.email,
      },
      {
        name: name || '',
        contact_person: contactPerson || null,
        phone: phone || null,
        email: email || null,
      },
      ['name', 'contact_person', 'phone', 'email']
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
  if (unlinkError) throw new Error(`Ошибка отвязки рейсов: ${unlinkError.message}`);

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId);
  if (error) throw new Error(`Ошибка удаления: ${error.message}`);

  await logAudit({
    entity_type: 'client',
    entity_id: clientId,
    action: 'delete',
    summary: before ? `Удалён клиент «${before.name}»` : 'Удалён клиент',
  });

  revalidatePath('/clients');
  redirect('/clients');
}
