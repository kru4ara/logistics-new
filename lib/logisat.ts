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

export type SummaryResult = {
  success: boolean;
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

// Надёжно приводим значение даты из БД или из формы (строка "YYYY-MM-DD", ISO, Date) к UTC-секундам.
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

// Общая функция: тянет кадры Logisat за период и считает метрики.
async function fetchFramesAndCompute(
  deviceId: string,
  startTs: number,
  endTs: number
): Promise<{
  frames: any[];
  fetchedOk: number;
  fetchedErr: number;
  distanceKm: number | null;
  fuelLiters: number | null;
  consumption: number | null;
  startOdometer: number | null;
  endOdometer: number | null;
  windowsCount: number;
}> {
  const windows = splitIntoWindows(startTs, endTs);
  const allFrames: any[] = [];
  let fetchedOk = 0;
  let fetchedErr = 0;

  for (const w of windows) {
    const url = `https://${SERVER}/atlas/${USERNAME}/historyextended/${deviceId}/${w.from}/${w.to}?password=${PASSWORD}`;
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

  allFrames.sort((a, b) => frameDate(a) - frameDate(b));

  const framesWithDistance = allFrames.filter((f) => f.totaldistance != null && f.totaldistance > 0);
  const framesWithFuel = allFrames.filter((f) => f.totalfuel != null && f.totalfuel > 0);

  let distanceKm: number | null = null;
  let fuelLiters: number | null = null;
  let consumption: number | null = null;
  let startOdometer: number | null = null;
  let endOdometer: number | null = null;

  if (framesWithDistance.length >= 2) {
    const fFirst = framesWithDistance[0];
    const fLast = framesWithDistance[framesWithDistance.length - 1];
    startOdometer = Math.round(fFirst.totaldistance / 1000);
    endOdometer = Math.round(fLast.totaldistance / 1000);
    distanceKm = Math.max(0, Math.round((fLast.totaldistance - fFirst.totaldistance) / 100) / 10);
  }

  if (framesWithFuel.length >= 2) {
    const fFirst = framesWithFuel[0];
    const fLast = framesWithFuel[framesWithFuel.length - 1];
    fuelLiters = Math.max(0, Math.round((fLast.totalfuel - fFirst.totalfuel) / 100) / 10);
  }

  if (distanceKm != null && distanceKm > 0 && fuelLiters != null) {
    consumption = Math.round((fuelLiters / distanceKm) * 1000) / 10;
  }

  return {
    frames: allFrames,
    fetchedOk,
    fetchedErr,
    distanceKm,
    fuelLiters,
    consumption,
    startOdometer,
    endOdometer,
    windowsCount: windows.length,
  };
}

// ============================================================
// Синхронизация рейса (сохраняет в trips) — используется из SyncLogisatButton
// ============================================================
export async function syncTripFromLogisat(tripId: string): Promise<SyncResult> {
  if (!SERVER || !USERNAME || !PASSWORD) {
    return { success: false, tripId, stage: 'env', error: 'Logisat не настроен (env переменные)' };
  }

  const supabase = await createClient();

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

  const computed = await fetchFramesAndCompute(truck.logisat_device_id, startTs, endTs);

  const periodDays = Math.round((endTs - startTs) / 8640) / 10;
  const period = {
    from: safeIsoFromSeconds(startTs),
    to: safeIsoFromSeconds(endTs),
    days: periodDays,
  };

  if (computed.frames.length === 0) {
    return {
      success: false,
      tripId,
      tripNumber: trip.trip_number,
      truck: truck.registration_number,
      deviceId: truck.logisat_device_id,
      period,
      framesCount: 0,
      stage: 'no_frames',
      error: `Logisat не вернул GPS-кадры за период ${period.from.slice(0, 10)} → ${period.to.slice(0, 10)} (${periodDays} дн.). Окна: ${computed.windowsCount}, успешных: ${computed.fetchedOk}, с ошибкой: ${computed.fetchedErr}.`,
    };
  }

  if (computed.distanceKm === null && computed.fuelLiters === null) {
    return {
      success: false,
      tripId,
      tripNumber: trip.trip_number,
      truck: truck.registration_number,
      deviceId: truck.logisat_device_id,
      period,
      framesCount: computed.frames.length,
      stage: 'no_sensors',
      error: `Получено ${computed.frames.length} кадров, но датчик одометра/топлива не передаёт данные (totaldistance и totalfuel = null). Проверь CAN-модуль на машине.`,
    };
  }

  const updateData: Record<string, any> = {
    logisat_synced_at: new Date().toISOString(),
  };

  if (computed.distanceKm != null) updateData.actual_km = computed.distanceKm;
  if (computed.fuelLiters != null) updateData.actual_liters = computed.fuelLiters;
  if (computed.startOdometer != null) updateData.start_odometer = computed.startOdometer;
  if (computed.endOdometer != null) updateData.end_odometer = computed.endOdometer;

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
    framesCount: computed.frames.length,
    distanceKm: computed.distanceKm ?? undefined,
    fuelLiters: computed.fuelLiters ?? undefined,
    consumption: computed.consumption ?? undefined,
    startOdometer: computed.startOdometer ?? undefined,
    endOdometer: computed.endOdometer ?? undefined,
  };
}

// ============================================================
// Только чтение (без записи в БД) — для страницы водителя /driver/logisat
// ============================================================
export async function fetchLogisatSummary(
  deviceId: string,
  fromIso: string,
  toIso: string
): Promise<SummaryResult> {
  if (!SERVER || !USERNAME || !PASSWORD) {
    return { success: false, stage: 'env', error: 'Logisat не настроен (env переменные)' };
  }
  if (!deviceId) {
    return { success: false, stage: 'device', error: 'Не указан deviceId машины' };
  }
  if (!fromIso || !toIso) {
    return { success: false, stage: 'period', error: 'Укажите период: с и по' };
  }

  const startTs = toUtcSeconds(fromIso, false);
  const endTs = toUtcSeconds(toIso, true);

  if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
    return {
      success: false,
      stage: 'period_parse',
      error: `Не удалось распарсить период (from="${fromIso}", to="${toIso}")`,
    };
  }
  if (endTs <= startTs) {
    return { success: false, stage: 'period_validate', error: 'Дата конца раньше даты начала' };
  }

  const computed = await fetchFramesAndCompute(deviceId, startTs, endTs);

  const periodDays = Math.round((endTs - startTs) / 8640) / 10;
  const period = {
    from: safeIsoFromSeconds(startTs),
    to: safeIsoFromSeconds(endTs),
    days: periodDays,
  };

  if (computed.frames.length === 0) {
    return {
      success: false,
      stage: 'no_frames',
      period,
      framesCount: 0,
      error: `Logisat не вернул GPS-кадры за период ${period.from.slice(0, 10)} → ${period.to.slice(0, 10)}. Машина не ездила или GPS не работал.`,
    };
  }

  if (computed.distanceKm === null && computed.fuelLiters === null) {
    return {
      success: false,
      stage: 'no_sensors',
      period,
      framesCount: computed.frames.length,
      error: `Получено ${computed.frames.length} кадров, но датчик одометра/топлива не передаёт данные. Проверьте CAN-модуль на машине.`,
    };
  }

  return {
    success: true,
    period,
    framesCount: computed.frames.length,
    distanceKm: computed.distanceKm ?? undefined,
    fuelLiters: computed.fuelLiters ?? undefined,
    consumption: computed.consumption ?? undefined,
    startOdometer: computed.startOdometer ?? undefined,
    endOdometer: computed.endOdometer ?? undefined,
  };
}
