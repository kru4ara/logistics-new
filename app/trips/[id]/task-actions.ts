'use server';

import { createClient } from '../../../lib/supabase-server';
import { revalidatePath } from 'next/cache';

export type SendTaskResult =
  | { success: true }
  | { success: false; error: string };

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
}

export async function sendTaskToDriver(tripId: string): Promise<SendTaskResult> {
  const supabase = await createClient();

  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .select('*, clients(name), drivers!driver_id(id, first_name, last_name, telegram_chat_id), trucks!truck_id(registration_number)')
    .eq('id', tripId)
    .single();

  if (tripErr || !trip) {
    return { success: false, error: 'Рейс не найден' };
  }

  // Подрядчики — чтобы понять, откуда водитель забирает груз
  const { data: subs } = await supabase
    .from('trip_subcontractors')
    .select('position, unload_country, unload_city, unload_company, unload_postal_code, unload_address, unload_date')
    .eq('trip_id', tripId)
    .order('position', { ascending: true });

  let consolidationPoint: any = null;
  if (subs && subs.length > 0) {
    const sorted = [...subs].sort((a: any, b: any) => {
      const posDiff = (b.position || 0) - (a.position || 0);
      if (posDiff !== 0) return posDiff;
      const aDate = a.unload_date ? new Date(a.unload_date).getTime() : 0;
      const bDate = b.unload_date ? new Date(b.unload_date).getTime() : 0;
      return bDate - aDate;
    });
    consolidationPoint = sorted[0];
  }

  const driver = Array.isArray((trip as any).drivers)
    ? (trip as any).drivers[0]
    : (trip as any).drivers;

  if (!driver) {
    return { success: false, error: 'У рейса не назначен водитель' };
  }
  if (!driver.telegram_chat_id) {
    return {
      success: false,
      error: `Водитель ${driver.first_name} ${driver.last_name} не подключён к Telegram. Пришлите ему ссылку из его карточки.`,
    };
  }

  // Собираем текст задания
  const lines: string[] = [];
  lines.push(`🚛 *Задание на рейс №${trip.trip_number || '—'}*`);
  lines.push('');

  if ((trip as any).clients?.name) {
    lines.push(`*Клиент:* ${(trip as any).clients.name}`);
  }
  lines.push(`*Маршрут:* ${trip.route || '—'}`);
  if (trip.start_date) {
    lines.push(`*Старт:* ${fmtDate(trip.start_date)}`);
  }
  lines.push('');

  const truck = Array.isArray((trip as any).trucks)
    ? (trip as any).trucks[0]
    : (trip as any).trucks;

  if (truck?.registration_number) {
    lines.push(`🚚 *Тягач:* ${truck.registration_number}`);
    lines.push('');
  }

  if (consolidationPoint) {
    // Наш участок C → Б
    lines.push('📍 *ЗАБИРАЕШЬ ГРУЗ У ПОДРЯДЧИКА:*');
    lines.push(`${consolidationPoint.unload_company || '—'}`);
    const cAddr = [
      consolidationPoint.unload_postal_code,
      consolidationPoint.unload_city,
      consolidationPoint.unload_country,
    ]
      .filter(Boolean)
      .join(', ');
    lines.push(`${cAddr || '—'}`);
    if (consolidationPoint.unload_address) {
      lines.push(`${consolidationPoint.unload_address}`);
    }
    if (consolidationPoint.unload_date) {
      lines.push(`📅 ${fmtDate(consolidationPoint.unload_date)}`);
    }
    lines.push('');
    lines.push('🏁 *ВЕЗЁШЬ ПОЛУЧАТЕЛЮ:*');
    lines.push(`${trip.receiver_name || '—'}`);
    const recvParts = [
      trip.receiver_country,
      trip.receiver_postal_code,
      trip.receiver_city,
      trip.receiver_address,
    ]
      .filter(Boolean)
      .join(', ');
    lines.push(`${recvParts || '—'}`);
    if (trip.receiver_loading_number) {
      lines.push(`№ погрузки: ${trip.receiver_loading_number}`);
    }
  } else {
    // Полный маршрут A → Б (только первая точка загрузки)
    if (trip.sender_city || trip.sender_name || trip.sender_country) {
      lines.push('📍 *ЗАГРУЗКА:*');
      lines.push(`${trip.sender_name || '—'}`);
      const addr = [
        trip.sender_country,
        trip.sender_postal_code,
        trip.sender_city,
        trip.sender_address,
      ]
        .filter(Boolean)
        .join(', ');
      lines.push(`   ${addr || '—'}`);
      if (trip.sender_loading_number) {
        lines.push(`   № погрузки: ${trip.sender_loading_number}`);
      }
      lines.push('');
    }

    if (trip.receiver_city || trip.receiver_name) {
      lines.push('🏁 *ВЫГРУЗКА:*');
      lines.push(`${trip.receiver_name || '—'}`);
      const recvParts = [
        trip.receiver_country,
        trip.receiver_postal_code,
        trip.receiver_city,
        trip.receiver_address,
      ]
        .filter(Boolean)
        .join(', ');
      lines.push(`${recvParts || '—'}`);
      if (trip.receiver_loading_number) {
        lines.push(`№ погрузки: ${trip.receiver_loading_number}`);
      }
    }
  }

  lines.push('');
  lines.push(`Открыть в приложении: https://logistics-new-ebon.vercel.app/driver/trips/${tripId}`);

  const text = lines.join('\n');

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { success: false, error: 'Не настроен TELEGRAM_BOT_TOKEN' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: driver.telegram_chat_id,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[sendTask] failed:', res.status, body);
      return { success: false, error: 'Telegram не принял сообщение' };
    }
  } catch (e) {
    console.error('[sendTask] exception:', e);
    return { success: false, error: 'Ошибка отправки в Telegram' };
  }

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
}
