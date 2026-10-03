'use server';

import { createClient } from '../../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { logAudit } from '../../lib/audit';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const STATUS_LABELS: Record<string, string> = {
  planned: 'Планируется',
  active: 'В пути',
  completed: 'Завершён',
  invoiced: 'Выставлен счёт',
  paid: 'Оплачен',
};

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

export async function changeTripStatus(
  tripId: string,
  status: string,
  endDate?: string
) {
  const supabase = await createClient();

  // 1. Получаем данные рейса перед обновлением
  const { data: trip } = await supabase
    .from('trips')
    .select('*, drivers(first_name, last_name), trucks(registration_number), clients(name)')
    .eq('id', tripId)
    .single();

  const oldStatus = trip?.status || null;

  const updateData: Record<string, any> = { status };
  const todayDate = new Date().toISOString().split('T')[0];

  // 2. Старт рейса — если пусто, ставим сегодня
  if (status === 'active' && !trip?.start_date) {
    updateData.start_date = todayDate;
  }

  // 3. Завершение — дата обязательна
  if (status === 'completed') {
    const finalEndDate = endDate || todayDate;

    if (trip?.start_date) {
      const startTs = new Date(trip.start_date).getTime();
      const endTs = new Date(finalEndDate).getTime();
      if (endTs < startTs) {
        throw new Error(
          `Дата завершения (${finalEndDate}) не может быть раньше даты старта (${trip.start_date})`
        );
      }
    }

    updateData.end_date = finalEndDate;

    if (!trip?.start_date) {
      updateData.start_date = finalEndDate;
    }
  }

  // 4. Обновляем
  const { error } = await supabase
    .from('trips')
    .update(updateData)
    .eq('id', tripId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);

  // 4.1. Логируем смену статуса в журнал
  if (trip && oldStatus !== status) {
    const fromLabel = STATUS_LABELS[oldStatus || ''] || oldStatus || '—';
    const toLabel = STATUS_LABELS[status] || status;

    await logAudit({
      entity_type: 'trip',
      entity_id: tripId,
      action: 'status_change',
      summary: `Рейс №${trip.trip_number || '—'}: статус «${fromLabel}» → «${toLabel}»`,
      changes: {
        status: { before: oldStatus, after: status },
      },
    });
  }

  // 5. Автосинхронизация Logisat при завершении
  if (status === 'completed') {
    try {
      const { syncTripFromLogisat } = await import('../../lib/logisat');
      const syncResult = await syncTripFromLogisat(tripId);
      if (syncResult.success) {
        console.log('[changeTripStatus] Logisat sync OK:', {
          tripId,
          km: syncResult.distanceKm,
          liters: syncResult.fuelLiters,
        });
      } else {
        console.log('[changeTripStatus] Logisat sync failed:', syncResult.error);
      }
    } catch (e) {
      console.error('[changeTripStatus] Logisat sync exception:', e);
    }
  }

  // 6. Telegram
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

    const lines = [
      `${statusEmoji[status] || '📋'} *Статус рейса изменён*`,
      '',
      `*Рейс:* № ${trip.trip_number || '—'}`,
      `*Клиент:* ${clientName}`,
      `*Маршрут:* ${trip.route || '—'}`,
      `*Водитель:* ${driverName}`,
      `*Машина:* ${truckNumber}`,
      '',
      `*Новый статус:* ${statusText[status] || status}`,
    ];

    if (status === 'completed' && updateData.end_date) {
      lines.push(`*Дата завершения:* ${updateData.end_date}`);
    }

    await sendTelegramMessage(lines.join('\n'));
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/driver/trips/${tripId}`);
  revalidatePath('/trips');
  revalidatePath('/driver');
}
