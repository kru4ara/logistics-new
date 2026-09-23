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
    return { success: false, tripId, tripNumber: trip.trip_number, error: 'У рейса нет тягача' };
  }

  if (!trip.start_date) {
    return { success: false, tripId, tripNumber: trip.trip_number, error: 'У рейса нет даты старта' };
  }

  // 2. Машина
  const { data: truck, error: truckErr } = await supabase
    .from('trucks')
    .select('id, registration_number, logisat_device_id, logisat_enabled')
    .eq('id', trip.truck_id)
    .single();

  if (truckErr || !truck) {
    return { success: false, tripId, tripNumber: trip.trip_number, error: 'Машина не найдена' };
  }

  if (!truck.logisat_enabled || !truck.logisat_device_id) {
    return {
      success: false,
      tripId,
      tripNumber: trip.trip_number,
      truck: truck.registration_number,
      error: `Машина ${truck.registration_number} не привязана к Logisat`,
    };
  }

  // 3. Период
  const startTs = Math.floor(new Date(trip.start_date + 'T00:00:00Z').getTime() / 1000);
  const endTs = trip.end_date
    ? Math.floor(new Date(trip.end_date + 'T23:59:59Z').getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  if (endTs <= startTs) {
    return {
      success: false,
      tripId,
      tripNumber: trip.trip_number,
      truck: truck.registration_number,
      error: 'Неверный период',
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
      // пропускаем окно
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  if (allFrames.length === 0) {
    return {
      success: false,
      tripId,
      tripNumber: trip.trip_number,
      truck: truck.registration_number,
      error: 'Logisat не вернул данные за этот период',
    };
  }

  allFrames.sort((a, b) => frameDate(a) - frameDate(b));

  const first = allFrames[0];
  const last = allFrames[allFrames.length - 1];

  const distDiffM = (last.totaldistance || 0) - (first.totaldistance || 0);
  const fuelDiffMl = (last.totalfuel || 0) - (first.totalfuel || 0);

  // Одометр — в км (округление до целого)
  const startOdometer = Math.round((first.totaldistance || 0) / 1000);
  const endOdometer = Math.round((last.totaldistance || 0) / 1000);

  // Пробег за рейс — с 1 знаком (метры → км)
  const distanceKm = Math.max(0, Math.round(distDiffM / 100) / 10);
  const fuelLiters = Math.max(0, Math.round(fuelDiffMl / 100) / 10);
  const consumption = distanceKm > 0
    ? Math.round((fuelLiters / distanceKm) * 1000) / 10
    : 0;

  if (distanceKm === 0 && fuelLiters === 0) {
    return {
      success: false,
      tripId,
      tripNumber: trip.trip_number,
      truck: truck.registration_number,
      error: 'Нет изменений — машина не двигалась в этот период',
    };
  }

  // 5. Сохраняем
  const { error: updateErr } = await supabase
    .from('trips')
    .update({
      actual_km: distanceKm,
      actual_liters: fuelLiters,
      start_odometer: startOdometer,
      end_odometer: endOdometer,
      logisat_synced_at: new Date().toISOString(),
    })
    .eq('id', tripId);

  if (updateErr) {
    return {
      success: false,
      tripId,
      tripNumber: trip.trip_number,
      truck: truck.registration_number,
      error: `Ошибка сохранения: ${updateErr.message}`,
    };
  }

  return {
    success: true,
    tripId,
    tripNumber: trip.trip_number,
    truck: truck.registration_number,
    period: {
      from: new Date(startTs * 1000).toISOString(),
      to: new Date(endTs * 1000).toISOString(),
      days: Math.round((endTs - startTs) / 8640) / 10,
    },
    framesCount: allFrames.length,
    distanceKm,
    fuelLiters,
    consumption,
    startOdometer,
    endOdometer,
  };
}
