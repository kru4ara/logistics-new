'use server';

import { supabase } from '../../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(text: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'Markdown',
      }),
    });
  } catch (e) {
    console.error('Ошибка отправки в Telegram:', e);
  }
}

export async function changeTripStatus(tripId: string, status: string) {
  // 1. Получаем данные рейса перед обновлением
  const { data: trip } = await supabase
    .from('trips')
    .select('*, drivers(first_name, last_name), trucks(registration_number), clients(name)')
    .eq('id', tripId)
    .single();

  // 2. Обновляем статус
  const { error } = await supabase
    .from('trips')
    .update({ status })
    .eq('id', tripId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);

  // 3. Отправляем уведомление в Telegram
  const statusEmoji: Record<string, string> = {
    active: '🚛',
    completed: '✅',
    invoiced: '💰',
    paid: '💶',
  };

  const statusText: Record<string, string> = {
    active: 'Начат',
    completed: 'Завершён',
    invoiced: 'Выставлен счёт',
    paid: 'Оплачен',
  };

  if (trip) {
    const driverName = trip.drivers
      ? `${trip.drivers.first_name} ${trip.drivers.last_name}`
      : 'Не указан';
    const truckNumber = trip.trucks?.registration_number || '—';
    const clientName = trip.clients?.name || '—';

    const message = [
      `${statusEmoji[status] || '📋'} *Статус рейса изменён*`,
      '',
      `*Рейс:* № ${trip.trip_number || '—'}`,
      `*Клиент:* ${clientName}`,
      `*Маршрут:* ${trip.route || '—'}`,
      `*Водитель:* ${driverName}`,
      `*Машина:* ${truckNumber}`,
      '',
      `*Новый статус:* ${statusText[status] || status}`,
    ].join('\n');

    await sendTelegramMessage(message);
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/driver/trips/${tripId}`);
  revalidatePath('/trips');
  revalidatePath('/driver');
}
