'use server';

import { supabase } from '../../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function changeTripStatus(tripId: string, status: string) {
  // 1. Записываем в базу
  const { error } = await supabase
    .from('trips')
    .update({
      status: status
    })
    .eq('id', tripId);

  if (error) {
    throw new Error(`Ошибка загрузки: ${error.message}`);
  }

  // 2. Получаем данные рейса (для уведомления)
  const { data: trip } = await supabase
    .from('trips')
    .select('route, start_date')
    .eq('id', tripId)
    .single();

  // 3. Отправляем Telegram-уведомление
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    const payload = {
      chat_id: TELEGRAM_CHAT_ID,
      text: `🚛 Статус рейса изменён!\n\nМаршрут: ${trip?.route || '-'}\nСтатус: ${status}`,
      parse_mode: 'Markdown'
    };

    const telegramResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!telegramResponse.ok) {
      console.error('Ошибка передачи в Telegram: ' + telegramResponse.status);
    }
  }

  revalidatePath(`/driver/trips/${tripId}`);
}
