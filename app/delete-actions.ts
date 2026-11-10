'use server';

import { requireOffice } from '../lib/require-office';
import { createClient } from '../lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function deleteClient(clientId: string) {
  await requireOffice();
  const supabase = await createClient();

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId);

  if (error) {
    throw new Error(`Ошибка удаления клиента: ${error.message}`);
  }
  revalidatePath('/clients');
  redirect('/clients?toast=client_deleted');
}

export async function deleteDriver(driverId: string) {
  await requireOffice();
  const supabase = await createClient();

  const { error } = await supabase
    .from('drivers')
    .delete()
    .eq('id', driverId);

  if (error) {
    throw new Error(`Ошибка удаления водителя: ${error.message}`);
  }
  revalidatePath('/drivers');
  redirect('/drivers?toast=driver_deleted');
}
