import { createClient } from './supabase-server';

const SERVER = process.env.LOGISAT_SERVER;
const USERNAME = process.env.LOGISAT_USERNAME;
const PASSWORD = process.env.LOGISAT_PASSWORD;

const MAX_WINDOW_SEC = 24 * 60 * 60;

export type SyncResult = {
  success: boolean;
  tripId: string;
  tripNumber?: number | null;
  truck?: string;
  deviceId?: string | null;
  error?: string;
  stage?: string;
  period?: { from: string; to: string; days: number };
  framesCount?: number;
  distanceKm?: number;
  fuelLiters?: number;
  consumption?: number;
  startOdometer?: number;
  endOdometer?: number;
};

function splitIntoWindows(fromTs: number, toTs: number): Array<{ from: number; to: number }> {
  const windows: Array<{ from: number; to: number }> = [];
  if (!Number.isFinite(fromTs) || !Number.isFinite(toTs)) return windows;
  let cursor = fromTs;
  while (cursor < toTs) {
    const end = Math.min(cursor + MAX_WINDOW_SEC, toTs);
    windows.push({ from: cursor, to: end });
    cursor = end;
  }
  return windows;
}

// Надёжно приводим значение даты из БД (строка "YYYY-MM-DD", ISO, Date) к UTC-секундам.
// isEnd=false → начало дня (00:00:00 UTC), isEnd=true → конец дня (23:59:59 UTC).
function toUtcSeconds(raw: unknown, isEnd: boolean): number {
  if (raw == null) return NaN;

  if (typeof raw === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const d = Number(m[3]);
      const ts = isEnd
        ? Date.UTC(y, mo, d, 23, 59, 59)
        : Date.UTC(y, mo, d, 0, 0, 0);
      return Math.floor(ts / 1000);
    }
  }

  const d = new Date(raw as string | number | Date);
  if (isNaN(d.getTime())) return NaN;

  const ts = isEnd
    ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59)
    : Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0);
  return Math.floor(ts / 1000);
}

function safeIsoFromSeconds(ts: number): string {
  if (!Number.isFinite(ts)) return new Date(0).toISOString();
  try {
    return new Date(ts * 1000).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

function frameDate(f: any): number {
  const d = f?.dateTime;
  if (!d || typeof d !== 'object') return 0;
  const ts = Date.UTC(
    Number(d.year) || 0,
    (Number(d.month) || 1) - 1,
    Number(d.day) || 1,
    Number(d.hour) || 0,
    Number(d.minute) || 0,
    Number(d.seconds ?? d.second) || 0
  );
  return Number.isFinite(ts) ? ts : 0;
}

export async function syncTripFromLogisat(tripId: string): Promise<SyncResult> {
  if (!SERVER || !USERNAME || !PASSWORD) {
    return { success: false, tripId, stage: 'env', error: 'Logisat не настроен (env переменные)' };
  }

  const supabase = await createClient();

  // 1. Рейс
  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .select('id, truck_id, start_date, end_date, trip_number')
    .eq('id', tripId)
    .single();

  if (tripErr || !trip) {
    return { success: false, tripId, stage: 'trip_lookup', error: 'Рейс не найден' };
  }

  if (!trip.truck_id) {
    return { success: false, tripId, tripNumber: trip.trip_number, stage: 'trip_validate', error: 'У рейса нет назначенного тягача' };
  }

  if (!trip.start_date) {
    return { success: false, tripId, tripNumber: trip.trip_number, stage: 'trip_validate', error: 'У рейса нет даты старта. Заполните в редактировании рейса.' };
  }

  if (!trip.end_date) {
    return { success: false, tripId, tripNumber: trip.trip_number, stage: 'trip_validate', error: 'У рейса нет даты финиша. Завершите рейс или укажите дату финиша в редактировании.' };
  }

  // 2. Машина
  const { data: truck, error: truckErr } = await supabase
    .from('trucks')
    .select('id, registration_number, logisat_device_id, logisat_enabled')
    .eq('id', trip.truck_id)
    .single();

  if (truckErr || !truck) {
    return { success: false, tripId, tripNumber: trip.trip_number, stage: 'truck_lookup', error: 'Машина не найдена' };
  }

  if (!truck.logisat_enabled) {
    return { success: false, tripId, tripNumber: trip.trip_number, truck: truck.registration_number, stage: 'truck_validate', error: `Машина ${truck.registration_number} не подключена к Logisat` };
  }

  if (!truck.logisat_device_id) {
    return { success: false, tripId, tripNumber: trip.trip_number, truck: truck.registration_number, stage: 'truck_validate', error: `У машины ${truck.registration_number} нет Logisat deviceId` };
  }

  // 3. Период — надёжный парсинг
  const startTs = toUtcSeconds(trip.start_date, false);
  const endTs = toUtcSeconds(trip.end_date, true);

  if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
    return {
      success: false,
      tripId,
      tripNumber: trip.trip_number,
      truck: truck.registration_number,
      deviceId: truck.logisat_device_id,
      stage: 'period_parse',
      error: `Не удалось распарсить даты рейса (start_date="${trip.start_date}", end_date="${trip.end_date}")`,
    };
  }

  if (endTs <= startTs) {
    return {
      success: false,
      tripId,
      tripNumber: trip.trip_number,
      truck: truck.registration_number,
      deviceId: truck.logisat_device_id,
      stage: 'period_validate',
      error: 'Дата финиша раньше даты старта',
    };
  }

  // 4. Запрос к Logisat
  const windows = splitIntoWindows(startTs, endTs);
  const allFrames: any[] = [];
  let fetchedOk = 0;
  let fetchedErr = 0;

  for (const w of windows) {
    const url = `https://${SERVER}/atlas/${USERNAME}/historyextended/${truck.logisat_device_id}/${w.from}/${w.to}?password=${PASSWORD}`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        fetchedErr++;
        continue;
      }
      const data = await res.json();
      const positions = Array.isArray(data) ? data : (data.positionList || data.history || []);
      if (Array.isArray(positions)) {
        allFrames.push(...positions);
        fetchedOk++;
      }
    } catch (e) {
      fetchedErr++;
      console.error('[logisat] fetch error', w, e);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const periodDays = Math.round((endTs - startTs) / 8640) / 10;
  const period = {
    from: safeIsoFromSeconds(startTs),
    to: safeIsoFromSeconds(endTs),
    days: periodDays,
  };

  if (allFrames.length === 0) {
    return {
      success: false,
      tripId,
      tripNumber: trip.trip_number,
      truck: truck.registration_number,
      deviceId: truck.logisat_device_id,
      period,
      framesCount: 0,
      stage: 'no_frames',
      error: `Logisat не вернул GPS-кадры за период ${period.from.slice(0, 10)} → ${period.to.slice(0, 10)} (${periodDays} дн.). Окна: ${windows.length}, успешных: ${fetchedOk}, с ошибкой: ${fetchedErr}.`,
    };
  }

  allFrames.sort((a, b) => frameDate(a) - frameDate(b));

  const framesWithDistance = allFrames.filter((f) => f.totaldistance != null && f.totaldistance > 0);
  const framesWithFuel = allFrames.filter((f) => f.totalfuel != null && f.totalfuel > 0);

  const hasDistance = framesWithDistance.length >= 2;
  const hasFuel = framesWithFuel.length >= 2;

  let distanceKm: number | null = null;
  let fuelLiters: number | null = null;
  let startOdometer: number | null = null;
  let endOdometer: number | null = null;
  let consumption: number | null = null;

  if (hasDistance) {
    const fFirst = framesWithDistance[0];
    const fLast = framesWithDistance[framesWithDistance.length - 1];
    const distDiffM = fLast.totaldistance - fFirst.totaldistance;
    startOdometer = Math.round(fFirst.totaldistance / 1000);
    endOdometer = Math.round(fLast.totaldistance / 1000);
    distanceKm = Math.max(0, Math.round(distDiffM / 100) / 10);
  }

  if (hasFuel) {
    const fFirst = framesWithFuel[0];
    const fLast = framesWithFuel[framesWithFuel.length - 1];
    const fuelDiffMl = fLast.totalfuel - fFirst.totalfuel;
    fuelLiters = Math.max(0, Math.round(fuelDiffMl / 100) / 10);
  }

  if (distanceKm != null && distanceKm > 0 && fuelLiters != null) {
    consumption = Math.round((fuelLiters / distanceKm) * 1000) / 10;
  }

  if (distanceKm === null && fuelLiters === null) {
    return {
      success: false,
      tripId,
      tripNumber: trip.trip_number,
      truck: truck.registration_number,
      deviceId: truck.logisat_device_id,
      period,
      framesCount: allFrames.length,
      stage: 'no_sensors',
      error: `Получено ${allFrames.length} кадров, но датчик одометра/топлива не передаёт данные (totaldistance и totalfuel = null). Проверь CAN-модуль на машине.`,
    };
  }

  const updateData: Record<string, any> = {
    logisat_synced_at: new Date().toISOString(),
  };

  if (distanceKm != null) updateData.actual_km = distanceKm;
  if (fuelLiters != null) updateData.actual_liters = fuelLiters;
  if (startOdometer != null) updateData.start_odometer = startOdometer;
  if (endOdometer != null) updateData.end_odometer = endOdometer;

  const { error: updateErr } = await supabase
    .from('trips')
    .update(updateData)
    .eq('id', tripId);

  if (updateErr) {
    return {
      success: false,
      tripId,
      tripNumber: trip.trip_number,
      truck: truck.registration_number,
      deviceId: truck.logisat_device_id,
      stage: 'db_update',
      error: `Ошибка сохранения в БД: ${updateErr.message}`,
    };
  }

  return {
    success: true,
    tripId,
    tripNumber: trip.trip_number,
    truck: truck.registration_number,
    deviceId: truck.logisat_device_id,
    period,
    framesCount: allFrames.length,
    distanceKm: distanceKm ?? undefined,
    fuelLiters: fuelLiters ?? undefined,
    consumption: consumption ?? undefined,
    startOdometer: startOdometer ?? undefined,
    endOdometer: endOdometer ?? undefined,
  };
}
