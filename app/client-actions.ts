'use server';

import { supabase } from '../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

export async function addClient(formData: FormData) {
  const name = formData.get('name') as string;
  const contactPerson = formData.get('contact_person') as string;
  const phone = formData.get('phone') as string;
  const email = formData.get('email') as string;

  const { error } = await supabase
    .from('clients')
    .insert([
      {
        name: name,
        contact_person: contactPerson || null,
        phone: phone || null,
        email: email || null
      }
    ]);

  if (error) {
    throw new Error(`Ошибка добавления: ${error.message}`);
  }

  revalidatePath('/clients');
}
