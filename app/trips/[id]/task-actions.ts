'use server';

import { createClient } from '../../../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { buildDriverTaskText } from '../../../lib/trip-task-text';

export type SendTaskResult =
  | { success: true }
  | { success: false; error: string };

function pickOne<T>(rel: unknown): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as T) ?? null;
  return rel as T;
}

function pickName(rel: unknown): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.name;
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name;
  }
  return undefined;
}

export async function sendTaskToDriver(tripId: string): Promise<SendTaskResult> {
  const supabase = await createClient();

  // ============================================================
  // Рейс + связи
  // ============================================================
  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .select('*, clients(name), drivers!driver_id(id, first_name, last_name, phone, telegram_chat_id), trucks!truck_id(registration_number)')
    .eq('id', tripId)
    .single();

  if (tripErr || !trip) {
    return { success: false, error: 'Рейс не найден' };
  }

  const driver = pickOne<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    telegram_chat_id: string | null;
  }>((trip as any).drivers);

  if (!driver) {
    return { success: false, error: 'У рейса не назначен водитель' };
  }
  if (!driver.telegram_chat_id) {
    return {
      success: false,
      error: `Водитель ${driver.first_name} ${driver.last_name} не подключён к Telegram. Пришлите ему ссылку из его карточки.`,
    };
  }

  const truck = pickOne<{ registration_number: string | null }>((trip as any).trucks);

  // Прицеп
  let trailerNumber: string | null = null;
  if ((trip as any).trailer_id) {
    const { data: trailer } = await supabase
      .from('trucks')
      .select('registration_number')
      .eq('id', (trip as any).trailer_id)
      .maybeSingle();
    trailerNumber = trailer?.registration_number || null;
  }

  // ============================================================
  // Сегменты + грузы сегментов
  // ============================================================
  const { data: segmentsRaw } = await supabase
    .from('trip_segments')
    .select('*')
    .eq('trip_id', tripId)
    .order('position', { ascending: true });

  const segmentIds = (segmentsRaw || []).map((s: any) => s.id);
  const segmentCargoRes = segmentIds.length > 0
    ? await supabase
        .from('trip_segment_cargo')
        .select('segment_id, cargo_id, trip_cargo(position, label)')
        .in('segment_id', segmentIds)
    : { data: [] as any[] };

  const cargoLinksBySegment: Record<string, { cargo_id: string; position: number; label: string }[]> = {};
  (segmentCargoRes.data || []).forEach((sc: any) => {
    if (!sc.segment_id || !sc.cargo_id) return;
    const meta = pickOne<{ position: number; label: string | null }>(sc.trip_cargo);
    if (!cargoLinksBySegment[sc.segment_id]) cargoLinksBySegment[sc.segment_id] = [];
    cargoLinksBySegment[sc.segment_id].push({
      cargo_id: sc.cargo_id,
      position: meta?.position || 0,
      label: meta?.label || '—',
    });
  });

  const segments = (segmentsRaw || []).map((s: any) => ({
    id: s.id,
    position: s.position,
    executor_type: s.executor_type,
    date_from: s.date_from,
    date_to: s.date_to,
    from_country: s.from_country,
    from_city: s.from_city,
    from_company: s.from_company,
    from_address: s.from_address,
    from_postal_code: s.from_postal_code,
    to_country: s.to_country,
    to_city: s.to_city,
    to_company: s.to_company,
    to_address: s.to_address,
    to_postal_code: s.to_postal_code,
    stops: Array.isArray(s.stops) ? s.stops : [],
    cargoLinks: cargoLinksBySegment[s.id] || [],
  }));

  // ============================================================
  // Подрядчики — для fallback, если сегментов нет
  // ============================================================
  const { data: subcontractors } = await supabase
    .from('trip_subcontractors')
    .select('position, unload_country, unload_city, unload_company, unload_postal_code, unload_address, unload_date')
    .eq('trip_id', tripId)
    .order('position', { ascending: true });

  // ============================================================
  // Собираем текст
  // ============================================================
  const text = buildDriverTaskText({
    trip: {
      ...trip,
      clients: { name: pickName((trip as any).clients) || null },
    },
    driver,
    truck,
    trailerNumber,
    segments,
    subcontractors: (subcontractors || []) as any,
    markdown: true,
  });

  // ============================================================
  // Отправка в Telegram
  // ============================================================
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
