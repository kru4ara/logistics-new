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
  let cursor = fromTs;
  while (cursor < toTs) {
    const end = Math.min(cursor + MAX_WINDOW_SEC, toTs);
    windows.push({ from: cursor, to: end });
    cursor = end;
  }
  return windows;
}

function frameDate(f: any): number {
  if (!f?.dateTime) return 0;
  const d = f.dateTime;
  return Date.UTC(d.year, d.month - 1, d.day, d.hour, d.minute, d.seconds);
}

export async function syncTripFromLogisat(tripId: string): Promise<SyncResult> {
  if (!SERVER || !USERNAME || !PASSWORD) {
    return { success: false, tripId, error: 'Logisat не настроен (env переменные)' };
  }

  const supabase = await createClient();

  // 1. Рейс
  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .select('id, truck_id, start_date, end_date, trip_number')
    .eq('id', tripId)
    .single();

  if (tripErr || !trip) {
    return { success: false, tripId, error: 'Рейс не найден' };
  }

  if (!trip.truck_id) {
    return {
      success: false,
      tripId,
      tripNumber: trip.trip_number,
      error: 'У рейса нет назначенного тягача',
    };
  }

  if (!trip.start_date) {
    return {
      success: false,
      tripId,
      tripNumber: trip.trip_number,
      error: 'У рейса нет даты старта. Заполните в редактировании рейса.',
    };
  }

  if (!trip.end_date) {
    return {
      success: false,
      tripId,
      tripNumber: trip.trip_number,
      error: 'У рейса нет даты финиша. Завершите рейс или укажите дату финиша в редактировании.',
    };
  }

  // 2. Машина
  const { data: truck, error: truckErr } = await supabase
    .from('trucks')
    .select('id, registration_number, logisat_device_id, logisat_enabled')
    .eq('id', trip.truck_id)
    .single();

  if (truckErr || !truck) {
    return {
      success: false,
      tripId,
      tripNumber: trip.trip_number,
      error: 'Машина не найдена',
    };
  }

  if (!truck.logisat_enabled) {
    return {
      success: false,
      tripId,
      tripNumber: trip.trip_number,
      truck: truck.registration_number,
      error: `Машина ${truck.registration_number} не подключена к Logisat`,
    };
  }

  if (!truck.logisat_device_id) {
    return {
      success: false,
      tripId,
      tripNumber: trip.trip_number,
      truck: truck.registration_number,
      error: `У машины ${truck.registration_number} нет Logisat deviceId`,
    };
  }

  // 3. Период
  const startTs = Math.floor(new Date(trip.start_date + 'T00:00:00Z').getTime() / 1000);
  const endTs = Math.floor(new Date(trip.end_date + 'T23:59:59Z').getTime() / 1000);

  if (endTs <= startTs) {
    return {
      success: false,
      tripId,
      tripNumber: trip.trip_number,
      truck: truck.registration_number,
      deviceId: truck.logisat_device_id,
      error: 'Дата финиша раньше даты старта',
    };
  }

  // 4. Запрос
  const windows = splitIntoWindows(startTs, endTs);
  const allFrames: any[] = [];

  for (const w of windows) {
    const url = `https://${SERVER}/atlas/${USERNAME}/historyextended/${truck.logisat_device_id}/${w.from}/${w.to}?password=${PASSWORD}`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      const positions = Array.isArray(data) ? data : (data.positionList || data.history || []);
      allFrames.push(...positions);
    } catch {
      // пропускаем
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const periodDays = Math.round((endTs - startTs) / 8640) / 10;
  const period = {
    from: new Date(startTs * 1000).toISOString(),
    to: new Date(endTs * 1000).toISOString(),
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
      error: `Logisat не вернул GPS-кадры за период ${trip.start_date} → ${trip.end_date} (${periodDays} дн.). Машина не ездила или GPS не работал.`,
    };
  }

  allFrames.sort((a, b) => frameDate(a) - frameDate(b));

  // ============================================================
  // ВАЖНО: ищем первый и последний кадр с ВАЛИДНЫМ totaldistance
  // (пропускаем кадры с null, которые часто бывают при старте/конце рейса)
  // ============================================================
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

  // Если ничего не посчитали — ошибка
  if (distanceKm === null && fuelLiters === null) {
    return {
      success: false,
      tripId,
      tripNumber: trip.trip_number,
      truck: truck.registration_number,
      deviceId: truck.logisat_device_id,
      period,
      framesCount: allFrames.length,
      error: `Получено ${allFrames.length} кадров, но датчик одометра/топлива не передаёт данные (totaldistance и totalfuel = null). Проверь CAN-модуль на машине.`,
    };
  }

  // 4. Сохраняем — что есть, то и пишем (не перезаписываем null-ом)
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
