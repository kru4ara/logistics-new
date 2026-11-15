import 'server-only';
import { splitWindows } from './metrics';
import type { GpsPoint, GpsProvider, GpsTrack } from './types';

// Logisat (atlas API). Переменные: LOGISAT_SERVER, LOGISAT_USERNAME, LOGISAT_PASSWORD.
// historyextended отдаёт кадры не больше чем за 24 ч — режем период на окна.
// Единицы кадра: totaldistance — метры, totalfuel — миллилитры.
// LOGISAT_API_URL — только для тестов (заглушка вместо https://<LOGISAT_SERVER>).

const MAX_WINDOW_SEC = 24 * 60 * 60;

export const isLogisatConfigured = () =>
  Boolean(process.env.LOGISAT_SERVER && process.env.LOGISAT_USERNAME && process.env.LOGISAT_PASSWORD);

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Кадр Logisat → общая точка трека. */
export function logisatFrameToPoint(f: any): GpsPoint {
  const d = f?.dateTime;
  const ts = d && typeof d === 'object'
    ? Date.UTC(Number(d.year) || 0, (Number(d.month) || 1) - 1, Number(d.day) || 1, Number(d.hour) || 0, Number(d.minute) || 0, Number(d.seconds ?? d.second) || 0)
    : 0;
  const fuelMl = num(f?.totalfuel);
  return {
    ts: Number.isFinite(ts) ? ts : 0,
    lat: num(f?.coordinate?.latitude),
    lng: num(f?.coordinate?.longitude),
    odometerM: num(f?.totaldistance),
    fuelUsedL: fuelMl != null ? fuelMl / 1000 : null,
    fuelLevelPct: num(f?.fuellevelperc),
    ignition: typeof f?.ignitionState === 'boolean' ? f.ignitionState : f?.ignitionState == null ? null : Boolean(f.ignitionState),
  };
}

export const logisat: GpsProvider = {
  id: 'logisat',
  name: 'Logisat',
  async fetchTrack(deviceId, fromSec, toSec): Promise<GpsTrack> {
    const server = process.env.LOGISAT_SERVER;
    const user = process.env.LOGISAT_USERNAME;
    const password = process.env.LOGISAT_PASSWORD ?? '';
    const windows = splitWindows(fromSec, toSec, MAX_WINDOW_SEC);
    const track: GpsTrack = { points: [], windows: windows.length, windowsOk: 0, windowsErr: 0, errors: [] };
    for (const w of windows) {
      const base = process.env.LOGISAT_API_URL || `https://${server}`;
      const url = `${base}/atlas/${encodeURIComponent(user ?? '')}/historyextended/${encodeURIComponent(deviceId)}/${w.from}/${w.to}?password=${encodeURIComponent(password)}`;
      try {
        const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
        if (!res.ok) {
          track.windowsErr++;
          track.errors.push(`window ${w.from}-${w.to}: HTTP ${res.status}`);
        } else {
          const data = await res.json();
          const frames = Array.isArray(data) ? data : data?.positionList || data?.history || [];
          if (Array.isArray(frames)) track.points.push(...frames.map(logisatFrameToPoint));
          track.windowsOk++;
        }
      } catch (e) {
        track.windowsErr++;
        track.errors.push(`window ${w.from}-${w.to}: ${e instanceof Error ? e.message : String(e)}`);
      }
      // пауза, чтобы не перегружать Logisat
      await new Promise((r) => setTimeout(r, 200));
    }
    track.points.sort((a, b) => a.ts - b.ts);
    return track;
  },
};
