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
  console.error('[changeTripStatus] CALLED', { tripId, status, endDate });

  const supabase = await createClient();

  // 1. Получаем данные рейса перед обновлением
  const { data: trip } = await supabase
    .from('trips')
    .select('*, drivers(first_name, last_name), trucks(registration_number), clients(name)')
    .eq('id', tripId)
    .single();

  const oldStatus = trip?.status || null;
  console.error('[changeTripStatus] oldStatus =', oldStatus, 'new =', status);

  const updateData: Record<string, any> = { status };
  const todayDate = new Date().toISOString().split('T')[0];

  if (status === 'active' && !trip?.start_date) {
    updateData.start_date = todayDate;
  }

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

  // 2. Обновляем
  const { error } = await supabase
    .from('trips')
    .update(updateData)
    .eq('id', tripId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);
  console.error('[changeTripStatus] UPDATE OK');

  // 3. Логируем смену статуса в журнал (с двух уровней — лог + прямой insert)
  if (trip && oldStatus !== status) {
    console.error('[changeTripStatus] === ENTERING AUDIT BLOCK ===');

    const fromLabel = STATUS_LABELS[oldStatus || ''] || oldStatus || '—';
    const toLabel = STATUS_LABELS[status] || status;

    try {
      // Прямой insert — изолированно от logAudit
      const { data: directInsert, error: directError } = await supabase
        .from('audit_log')
        .insert([
          {
            user_role: 'admin',
            user_id: null,
            user_name: 'Офис',
            entity_type: 'trip',
            entity_id: tripId,
            action: 'status_change',
            summary: `Рейс №${trip.trip_number || '—'}: статус «${fromLabel}» → «${toLabel}»`,
            changes: { status: { before: oldStatus, after: status } },
          },
        ])
        .select('id');

      console.error('[changeTripStatus] DIRECT INSERT:', directInsert, directError);
    } catch (e) {
      console.error('[changeTripStatus] DIRECT INSERT EXCEPTION:', e);
    }

    // И вызываем logAudit — если он работает, дубля не будет (разные записи)
    try {
      await logAudit({
        entity_type: 'trip',
        entity_id: tripId,
        action: 'status_change',
        summary: `Рейс №${trip.trip_number || '—'}: статус «${fromLabel}» → «${toLabel}»`,
        changes: { status: { before: oldStatus, after: status } },
      });
      console.error('[changeTripStatus] logAudit OK');
    } catch (e) {
      console.error('[changeTripStatus] logAudit EXCEPTION:', e);
    }
  } else {
    console.error('[changeTripStatus] AUDIT SKIPPED', { hasTrip: !!trip, oldStatus, status });
  }

  // 4. Logisat sync при завершении
  if (status === 'completed') {
    try {
      const { syncTripFromLogisat } = await import('../../lib/logisat');
      const syncResult = await syncTripFromLogisat(tripId);
      if (syncResult.success) {
        console.error('[changeTripStatus] Logisat sync OK');
      } else {
        console.error('[changeTripStatus] Logisat sync failed:', syncResult.error);
      }
    } catch (e) {
      console.error('[changeTripStatus] Logisat sync exception:', e);
    }
  }

  // 5. Telegram
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
