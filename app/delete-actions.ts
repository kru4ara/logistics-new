'use server';

import { createClient } from '../lib/supabase-server';
import { revalidatePath } from 'next/cache';

export async function deleteClient(clientId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId);

  if (error) {
    throw new Error(`Ошибка удаления клиента: ${error.message}`);
  }
  revalidatePath('/clients');
}

export async function deleteDriver(driverId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('drivers')
    .delete()
    .eq('id', driverId);

  if (error) {
    throw new Error(`Ошибка удаления водителя: ${error.message}`);
  }
  revalidatePath('/drivers');
}
