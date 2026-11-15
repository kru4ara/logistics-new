// Расчёт пробега и топлива по треку — чистые правила, общие для всех GPS-сервисов (тесты).
import type { GpsPoint } from './types';

/** Окна запроса не длиннее maxSec. */
export function splitWindows(fromSec: number, toSec: number, maxSec: number): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  if (!Number.isFinite(fromSec) || !Number.isFinite(toSec) || maxSec <= 0) return out;
  for (let c = fromSec; c < toSec; ) {
    const end = Math.min(c + maxSec, toSec);
    out.push({ from: c, to: end });
    c = end;
  }
  return out;
}

/**
 * Дата из БД или формы («YYYY-MM-DD», ISO, Date) → UTC-секунды начала (isEnd=false)
 * или конца (isEnd=true) суток. Не дата — NaN.
 */
export function toUtcSeconds(raw: unknown, isEnd: boolean): number {
  if (raw == null || raw === '') return NaN;
  let y: number, mo: number, d: number;
  const m = typeof raw === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw) : null;
  if (m) {
    [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  } else {
    const dt = new Date(raw as string | number | Date);
    if (Number.isNaN(dt.getTime())) return NaN;
    [y, mo, d] = [dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()];
  }
  return Math.floor((isEnd ? Date.UTC(y, mo, d, 23, 59, 59) : Date.UTC(y, mo, d)) / 1000);
}

export const isoFromSeconds = (s: number) => new Date(Number.isFinite(s) ? s * 1000 : 0).toISOString();

export type TrackMetrics = {
  distanceKm: number | null;
  fuelLiters: number | null;
  /** л / 100 км */
  consumption: number | null;
  startOdometer: number | null;
  endOdometer: number | null;
};

/**
 * Пробег — разница одометра между первой и последней точкой с показанием (> 0),
 * топливо — разница счётчика топлива. Нужны минимум две точки с показанием.
 */
export function computeMetrics(points: GpsPoint[]): TrackMetrics {
  const sorted = [...points].sort((a, b) => a.ts - b.ts);
  const odo = sorted.filter((p) => p.odometerM != null && p.odometerM > 0);
  const fuel = sorted.filter((p) => p.fuelUsedL != null && p.fuelUsedL > 0);
  const r: TrackMetrics = { distanceKm: null, fuelLiters: null, consumption: null, startOdometer: null, endOdometer: null };
  if (odo.length >= 2) {
    const a = odo[0].odometerM!;
    const b = odo[odo.length - 1].odometerM!;
    r.startOdometer = Math.round(a / 1000);
    r.endOdometer = Math.round(b / 1000);
    r.distanceKm = Math.max(0, Math.round((b - a) / 100) / 10);
  }
  if (fuel.length >= 2) {
    const a = fuel[0].fuelUsedL!;
    const b = fuel[fuel.length - 1].fuelUsedL!;
    r.fuelLiters = Math.max(0, Math.round((b - a) * 10) / 10);
  }
  if (r.distanceKm != null && r.distanceKm > 0 && r.fuelLiters != null) {
    r.consumption = Math.round((r.fuelLiters / r.distanceKm) * 1000) / 10;
  }
  return r;
}

/** «2026-11-15 08:05:09» (UTC) — для служебных ответов. */
export function pointTime(p: GpsPoint | undefined): string {
  return p ? new Date(p.ts).toISOString().replace('T', ' ').slice(0, 19) : '—';
}

/** Первая/последняя точка для служебных экранов (поля — как в прежнем ответе Logisat: м и мл). */
export function pointSummary(p: GpsPoint | undefined) {
  if (!p) return null;
  return {
    time: pointTime(p),
    totaldistance: p.odometerM,
    totalfuel: p.fuelUsedL != null ? Math.round(p.fuelUsedL * 1000) : null,
    fuellevelperc: p.fuelLevelPct,
    ignitionState: p.ignition == null ? null : p.ignition ? 'on' : 'off',
    lat: p.lat,
    lng: p.lng,
  };
}
