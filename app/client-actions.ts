'use server';

import { createClient } from '../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function updateClient(clientId: string, formData: FormData) {
  const supabase = await createClient();

  const name = formData.get('name') as string;
  const contactPerson = formData.get('contact_person') as string;
  const phone = formData.get('phone') as string;
  const email = formData.get('email') as string;

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
  revalidatePath('/clients');
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function deleteClient(clientId: string) {
  const supabase = await createClient();

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

  revalidatePath('/clients');
  redirect('/clients');
}
