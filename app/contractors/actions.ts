'use server';

import { createClient } from '../../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createContractor(formData: FormData) {
  const supabase = await createClient();

  const name = (formData.get('name') as string)?.trim();
  const fullName = (formData.get('full_name') as string)?.trim() || null;
  const address = (formData.get('address') as string)?.trim() || null;
  const taxId = (formData.get('tax_id') as string)?.trim() || null;
  const contactPerson = (formData.get('contact_person') as string)?.trim() || null;
  const phone = (formData.get('phone') as string)?.trim() || null;
  const email = (formData.get('email') as string)?.trim() || null;
  const notes = (formData.get('notes') as string)?.trim() || null;

  if (!name) throw new Error('Название обязательно');

  const { error } = await supabase
    .from('contractors')
    .insert([{
      name,
      full_name: fullName,
      address,
      tax_id: taxId,
      contact_person: contactPerson,
      phone,
      email,
      notes,
    }]);

  if (error) throw new Error(`Ошибка создания: ${error.message}`);
  revalidatePath('/contractors');
  redirect('/contractors');
}

export async function updateContractor(contractorId: string, formData: FormData) {
  const supabase = await createClient();

  const name = (formData.get('name') as string)?.trim();
  const fullName = (formData.get('full_name') as string)?.trim() || null;
  const address = (formData.get('address') as string)?.trim() || null;
  const taxId = (formData.get('tax_id') as string)?.trim() || null;
  const contactPerson = (formData.get('contact_person') as string)?.trim() || null;
  const phone = (formData.get('phone') as string)?.trim() || null;
  const email = (formData.get('email') as string)?.trim() || null;
  const notes = (formData.get('notes') as string)?.trim() || null;

  if (!name) throw new Error('Название обязательно');

  const { error } = await supabase
    .from('contractors')
    .update({
      name,
      full_name: fullName,
      address,
      tax_id: taxId,
      contact_person: contactPerson,
      phone,
      email,
      notes,
    })
    .eq('id', contractorId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);
  revalidatePath('/contractors');
  redirect('/contractors');
}

export async function deleteContractor(contractorId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('contractors')
    .delete()
    .eq('id', contractorId);

  if (error) throw new Error(`Ошибка удаления: ${error.message}`);
  revalidatePath('/contractors');
}
