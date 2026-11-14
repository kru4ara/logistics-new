'use server';

import { createClient } from '../../lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requireCapability } from '../../lib/require-office';
import { getT } from '../../lib/i18n/server';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function sendReminderNotification(reminderId: string) {
  const { t } = await getT();
  // Иначе любой залогиненный мог слать сообщения в рабочий Telegram-чат.
  await requireCapability('reminders.edit');
  const supabase = await createClient();

  const { data: reminder } = await supabase
    .from('reminders')
    .select('*')
    .eq('id', reminderId)
    .single();

  if (!reminder || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return { success: false, message: t('rem.tgNoData') };
  }

  const daysLeft = Math.ceil(
    (new Date(reminder.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysLeft <= 0) {
    return { success: false, message: t('rem.tgRed') };
  }

  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text: `⏰ **Напоминание**\n\n${reminder.title}\n\n📅 Дата: ${reminder.due_date}\n💡 Осталось: ${daysLeft} дн.`,
    parse_mode: 'Markdown'
  };

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    return { success: false, message: t('rem.tgFailed') };
  }

  revalidatePath('/reminders');
  return { success: true, message: t('rem.tgSent') };
}
