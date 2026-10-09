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

// ============================================================
// Хелперы для relations (Supabase может вернуть объект ИЛИ массив)
// ============================================================
function pickOne<T>(rel: unknown): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as T) ?? null;
  return rel as T;
}

function pickName(rel: unknown): string {
  if (!rel) return '';
  if (Array.isArray(rel)) return rel[0]?.name || '';
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name || '';
  }
  return '';
}

// ============================================================
// Telegram: в офисный чат
// ============================================================
async function sendTelegramMessage(text: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('[telegram/office] failed:', res.status, body);
    }
  } catch (e) {
    console.error('[telegram/office] exception:', e);
  }
}

// ============================================================
// changeTripStatus
// ============================================================
export async function changeTripStatus(
  tripId: string,
  status: string,
  endDate?: string
) {
  const supabase = await createClient();

  // Забираем рейс + relations.
  // Явные FK-алиасы (!driver_id, !truck_id) обязательны — у trips
  // два FK на trucks (truck_id и trailer_id).
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select(`
      *,
      drivers!driver_id(first_name, last_name),
      trucks!truck_id(registration_number),
      clients(name)
    `)
    .eq('id', tripId)
    .single();

  if (tripError) {
    console.error('[changeTripStatus] failed to load trip:', tripError.message);
  }

  const oldStatus = trip?.status || null;

  const updateData: Record<string, any> = { status };
  const todayDate = new Date().toISOString().split('T')[0];

  // Старт рейса — если пусто, ставим сегодня
  if (status === 'active' && !trip?.start_date) {
    updateData.start_date = todayDate;
  }

  // Завершение — дата обязательна
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

  // Обновляем
  const { error } = await supabase
    .from('trips')
    .update(updateData)
    .eq('id', tripId);

  if (error) throw new Error(`Ошибка обновления: ${error.message}`);

  // Логируем смену статуса
  if (trip && oldStatus !== status) {
    const fromLabel = STATUS_LABELS[oldStatus || ''] || oldStatus || '—';
    const toLabel = STATUS_LABELS[status] || status;

    try {
      await logAudit({
        entity_type: 'trip',
        entity_id: tripId,
        action: 'status_change',
        summary: `Рейс №${trip.trip_number || '—'}: статус «${fromLabel}» → «${toLabel}»`,
        changes: {
          status: { before: oldStatus, after: status },
        },
      });
    } catch (e) {
      console.error('[changeTripStatus] audit failed:', e);
    }
  }

  // Автосинхронизация Logisat при завершении
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

  // ============================================================
  // Telegram — только в офисный чат, только при active / completed
  // ============================================================
  if (trip && oldStatus !== status && (status === 'active' || status === 'completed')) {
    const driver = pickOne<{
      first_name: string | null;
      last_name: string | null;
    }>(trip.drivers);

    const truck = pickOne<{ registration_number: string | null }>(trip.trucks);
    const clientName = pickName(trip.clients) || '—';

    const driverName = driver
      ? `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || 'Не указан'
      : 'Не указан';
    const truckNumber = truck?.registration_number || '—';
    const tripNumber = trip.trip_number || '—';
    const route = trip.route || '—';

    const statusEmoji: Record<string, string> = {
      active: '🚛',
      completed: '✅',
    };
    const statusText: Record<string, string> = {
      active: 'Начат',
      completed: 'Завершён',
    };

    const lines = [
      `${statusEmoji[status]} *Рейс №${tripNumber} · статус изменён*`,
      '',
      `*Клиент:* ${clientName}`,
      `*Маршрут:* ${route}`,
      `*Водитель:* ${driverName}`,
      `*Машина:* ${truckNumber}`,
      '',
      `*Новый статус:* ${statusText[status]}`,
    ];

    if (status === 'completed' && updateData.end_date) {
      const endRu = new Date(updateData.end_date).toLocaleDateString('ru-RU');
      lines.push(`*Дата завершения:* ${endRu}`);
    }

    await sendTelegramMessage(lines.join('\n'));
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/driver/trips/${tripId}`);
  revalidatePath('/trips');
  revalidatePath('/driver');
  revalidatePath('/today');
}
