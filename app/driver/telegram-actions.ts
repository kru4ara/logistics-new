'use server';

import { revalidatePath } from 'next/cache';
import { getActorContext } from '../../lib/driver-access';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function sendDriverNotification(
  driverId: string,
  driverName: string,
  dueDate: string
) {
  // Экшен шлёт сообщение в офисный чат от имени водителя — доступен
  // только офису, иначе водитель мог бы спамить в чат произвольными данными.
  const actor = await getActorContext();
  if (!actor.isOffice) {
    return { success: false, error: 'Нет доступа' };
  }

  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    const payload = {
      chat_id: TELEGRAM_CHAT_ID,
      text: `📄 Документ водителя истекает!\n\nВодитель: ${driverName}\nДата: ${dueDate}`,
      parse_mode: 'Markdown',
    };

    try {
      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!telegramResponse.ok) {
        console.error('Ошибка передачи в Telegram: ' + telegramResponse.status);
      }
    } catch (e) {
      console.error('Ошибка вызова Telegram API:', e);
    }
  }

  revalidatePath(`/drivers/${driverId}`);
  return { success: true };
}
