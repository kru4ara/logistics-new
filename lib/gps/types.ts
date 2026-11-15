// Общий интерфейс GPS-мониторинга. Каждый сервис (Logisat, …) — модуль в lib/gps/,
// выбор — переменная GPS_PROVIDER (или по заданным ключам). Расчёт пробега и топлива —
// один на всех: lib/gps/metrics.ts.

export type GpsProviderId = 'logisat';
export const GPS_PROVIDER_IDS: readonly GpsProviderId[] = ['logisat'];

/** Точка трека в единицах, общих для всех сервисов. */
export type GpsPoint = {
  /** время, мс UTC */
  ts: number;
  lat: number | null;
  lng: number | null;
  /** одометр (CAN), метры */
  odometerM: number | null;
  /** счётчик израсходованного топлива (CAN), литры */
  fuelUsedL: number | null;
  /** уровень в баке, % */
  fuelLevelPct: number | null;
  ignition: boolean | null;
};

export type GpsTrack = {
  points: GpsPoint[];
  /** сколько окон запроса прошло / с ошибкой (у Logisat окно ≤ 24 ч) */
  windows: number;
  windowsOk: number;
  windowsErr: number;
  errors: string[];
};

export interface GpsProvider {
  id: GpsProviderId;
  name: string;
  /** трек устройства за период [fromSec, toSec], точки по времени */
  fetchTrack(deviceId: string, fromSec: number, toSec: number): Promise<GpsTrack>;
}
