'use server';

import { supabase } from '../../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function sendDriverNotification(driverId: string, driverName: string, dueDate: string) {
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    const payload = {
      chat_id: TELEGRAM_CHAT_ID,
      text: `📄 Документ водителя истекает!\n\nВодитель: ${driverName}\nДата: ${dueDate}`,
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

  revalidatePath(`/drivers/${driverId}`);
}
