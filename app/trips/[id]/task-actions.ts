'use server';

import { createClient } from '../../../lib/supabase/admin';
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
    .select('*, clients(name), drivers!driver_id(id, first_name, last_name, phone_by, phone_pl, telegram_chat_id), trucks!truck_id(registration_number)')
    .eq('id', tripId)
    .single();

  if (tripErr || !trip) {
    return { success: false, error: 'Рейс не найден' };
  }

  const driver = pickOne<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    phone_by: string | null;
    phone_pl: string | null;
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

  // Прицеп рейса (шапка)
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
  // Сегменты (с тягачом и прицепом) + грузы сегментов
  // ============================================================
  const { data: segmentsRaw } = await supabase
    .from('trip_segments')
    .select('*, trucks!truck_id(registration_number), trailers:trucks!trailer_id(registration_number)')
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

  const segments = (segmentsRaw || []).map((s: any) => {
    const segTruck = pickOne<{ registration_number: string | null }>(s.trucks);
    const segTrailer = pickOne<{ registration_number: string | null }>(s.trailer);
    return {
      id: s.id,
      position: s.position,
      executor_type: s.executor_type,
      date_from: s.date_from,
      date_to: s.date_to,
      truck_reg: segTruck?.registration_number || null,
      trailer_reg: segTrailer?.registration_number || null,
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
    };
  });

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

// ============================================================
// Отправка задания водителю ОДНОГО участка (executor_type='us')
// ============================================================
export async function sendSegmentTaskToDriver(
  tripId: string,
  segmentId: string
): Promise<SendTaskResult> {
  const supabase = await createClient();

  // ============================================================
  // Сегмент
  // ============================================================
  const { data: segment, error: segErr } = await supabase
    .from('trip_segments')
    .select('*')
    .eq('id', segmentId)
    .maybeSingle();

  if (segErr || !segment) {
    return { success: false, error: 'Участок не найден' };
  }
  if (segment.trip_id !== tripId) {
    return { success: false, error: 'Участок не относится к этому рейсу' };
  }
  if (segment.executor_type !== 'us') {
    return { success: false, error: 'Это участок подрядчика — задание водителю не отправляем' };
  }
  if (!segment.driver_id) {
    return { success: false, error: 'На участке не назначен водитель' };
  }

  // ============================================================
  // Водитель сегмента
  // ============================================================
  const { data: driverRow, error: driverErr } = await supabase
    .from('drivers')
    .select('id, first_name, last_name, phone_by, phone_pl, telegram_chat_id')
    .eq('id', segment.driver_id)
    .maybeSingle();

  if (driverErr || !driverRow) {
    return { success: false, error: 'Водитель не найден' };
  }
  if (!driverRow.telegram_chat_id) {
    return {
      success: false,
      error: `${driverRow.first_name || ''} ${driverRow.last_name || ''} не подключён к Telegram. Пришлите ему ссылку из карточки водителя.`.trim(),
    };
  }

  const driver = {
    id: driverRow.id,
    first_name: driverRow.first_name,
    last_name: driverRow.last_name,
    phone_by: driverRow.phone_by,
    phone_pl: driverRow.phone_pl,
    telegram_chat_id: driverRow.telegram_chat_id,
  };

  // ============================================================
  // Тягач сегмента + прицеп сегмента
  // ============================================================
  let truck: { registration_number: string | null } | null = null;
  if (segment.truck_id) {
    const { data: truckRow } = await supabase
      .from('trucks')
      .select('registration_number')
      .eq('id', segment.truck_id)
      .maybeSingle();
    truck = truckRow ? { registration_number: truckRow.registration_number } : null;
  }

  let trailerNumber: string | null = null;
  if (segment.trailer_id) {
    const { data: trailer } = await supabase
      .from('trucks')
      .select('registration_number')
      .eq('id', segment.trailer_id)
      .maybeSingle();
    trailerNumber = trailer?.registration_number || null;
  }

  // ============================================================
  // Грузы сегмента
  // ============================================================
  const { data: segmentCargoRaw } = await supabase
    .from('trip_segment_cargo')
    .select('cargo_id, trip_cargo(position, label)')
    .eq('segment_id', segmentId);

  const cargoLinks = (segmentCargoRaw || []).map((sc: any) => {
    const meta = pickOne<{ position: number; label: string | null }>(sc.trip_cargo);
    return {
      cargo_id: sc.cargo_id as string,
      position: meta?.position || 0,
      label: meta?.label || '—',
    };
  });

  // ============================================================
  // Рейс (для шапки) — БЕЗ route (колонка удалена)
  // ============================================================
  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .select('id, trip_number, start_date, client_id, clients(name)')
    .eq('id', tripId)
    .single();

  if (tripErr || !trip) {
    return { success: false, error: 'Рейс не найден' };
  }

  // ============================================================
  // Один сегмент → в buildDriverTaskText
  // ============================================================
  const segmentForBuild = {
    id: segment.id,
    position: segment.position,
    executor_type: segment.executor_type,
    date_from: segment.date_from,
    date_to: segment.date_to,
    truck_reg: truck?.registration_number || null,
    trailer_reg: trailerNumber,
    from_country: segment.from_country,
    from_city: segment.from_city,
    from_company: segment.from_company,
    from_address: segment.from_address,
    from_postal_code: segment.from_postal_code,
    to_country: segment.to_country,
    to_city: segment.to_city,
    to_company: segment.to_company,
    to_address: segment.to_address,
    to_postal_code: segment.to_postal_code,
    stops: Array.isArray(segment.stops) ? segment.stops : [],
    cargoLinks,
  };

  const text = buildDriverTaskText({
    trip: {
      ...trip,
      clients: { name: pickName((trip as any).clients) || null },
    },
    driver,
    truck,
    trailerNumber,
    segments: [segmentForBuild],
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
      console.error('[sendSegmentTask] failed:', res.status, body);
      return { success: false, error: 'Telegram не принял сообщение' };
    }
  } catch (e) {
    console.error('[sendSegmentTask] exception:', e);
    return { success: false, error: 'Ошибка отправки в Telegram' };
  }

  revalidatePath(`/trips/${tripId}`);
  return { success: true };
}
