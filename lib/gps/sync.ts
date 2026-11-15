import 'server-only';
import { createClient } from '../supabase/admin';
import { getGpsProvider } from './index';
import { computeMetrics, toUtcSeconds, isoFromSeconds } from './metrics';
import type { GpsProvider } from './types';

// Пробег и топливо рейса по GPS — для любого GPS-сервиса компании (lib/gps/index.ts).
// ID устройства машины — trucks.logisat_device_id, включение — trucks.logisat_enabled
// (имена колонок исторические, значение — ID в GPS-сервисе компании).

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

async function trackMetrics(gps: GpsProvider, deviceId: string, startTs: number, endTs: number) {
  const track = await gps.fetchTrack(deviceId, startTs, endTs);
  return {
    frames: track.points,
    fetchedOk: track.windowsOk,
    fetchedErr: track.windowsErr,
    windowsCount: track.windows,
    ...computeMetrics(track.points),
  };
}

// ============================================================
// Синхронизация рейса (сохраняет в trips): пробег, топливо, одометр за даты рейса
// ============================================================
export async function syncTripFromGps(tripId: string): Promise<SyncResult> {
  const gps = getGpsProvider();
  if (!gps) {
    return { success: false, tripId, stage: 'env', error: 'GPS не настроен (переменные окружения)' };
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
    return { success: false, tripId, tripNumber: trip.trip_number, truck: truck.registration_number, stage: 'truck_validate', error: `Машина ${truck.registration_number} не подключена к GPS (${gps.name})` };
  }

  if (!truck.logisat_device_id) {
    return { success: false, tripId, tripNumber: trip.trip_number, truck: truck.registration_number, stage: 'truck_validate', error: `У машины ${truck.registration_number} нет ID устройства ${gps.name}` };
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

  const computed = await trackMetrics(gps, truck.logisat_device_id, startTs, endTs);

  const periodDays = Math.round((endTs - startTs) / 8640) / 10;
  const period = {
    from: isoFromSeconds(startTs),
    to: isoFromSeconds(endTs),
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
      error: `${gps.name} не вернул GPS-точки за период ${period.from.slice(0, 10)} → ${period.to.slice(0, 10)} (${periodDays} дн.). Окна: ${computed.windowsCount}, успешных: ${computed.fetchedOk}, с ошибкой: ${computed.fetchedErr}.`,
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
export async function fetchGpsSummary(
  deviceId: string,
  fromIso: string,
  toIso: string
): Promise<SummaryResult> {
  const gps = getGpsProvider();
  if (!gps) {
    return { success: false, stage: 'env', error: 'GPS не настроен (переменные окружения)' };
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

  const computed = await trackMetrics(gps, deviceId, startTs, endTs);

  const periodDays = Math.round((endTs - startTs) / 8640) / 10;
  const period = {
    from: isoFromSeconds(startTs),
    to: isoFromSeconds(endTs),
    days: periodDays,
  };

  if (computed.frames.length === 0) {
    return {
      success: false,
      stage: 'no_frames',
      period,
      framesCount: 0,
      error: `${gps.name} не вернул GPS-точки за период ${period.from.slice(0, 10)} → ${period.to.slice(0, 10)}. Машина не ездила или GPS не работал.`,
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
