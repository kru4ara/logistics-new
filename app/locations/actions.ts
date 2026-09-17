'use server';

import { supabase } from '../../lib/supabaseClient';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createLocation(formData: FormData) {
  const name = formData.get('name') as string;
  const type = formData.get('type') as string;
  const country = formData.get('country') as string;
  const companyName = formData.get('company_name') as string;
  const postalCode = formData.get('postal_code') as string;
  const city = formData.get('city') as string;
  const address = formData.get('address') as string;
  const defaultLoadingNumber = formData.get('default_loading_number') as string;

  const { error } = await supabase
    .from('locations')
    .insert([
      {
        name,
        type,
        country: country || null,
        company_name: companyName || null,
        postal_code: postalCode || null,
        city: city || null,
        address: address || null,
        default_loading_number: defaultLoadingNumber || null,
      }
    ]);

  if (error) throw new Error(`Ошибка добавления: ${error.message}`);
  revalidatePath('/locations');
  redirect('/locations');
}

export async function deleteLocation(locationId: string) {
  const { error } = await supabase.from('locations').delete().eq('id', locationId);
  if (error) throw new Error(`Ошибка удаления: ${error.message}`);
  revalidatePath('/locations');
}
