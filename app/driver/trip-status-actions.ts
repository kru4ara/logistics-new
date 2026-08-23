'use server';

import { supabase } from '../../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function changeTripStatus(tripId: string, status: string) {
  const { error } = await supabase
    .from('trips')
    .update({
      status: status
    })
    .eq('id', tripId);

  if (error) {
    throw new Error(`Ошибка загрузки: ${error.message}`);
  }

  revalidatePath(`/driver/trips/${tripId}`);
}
