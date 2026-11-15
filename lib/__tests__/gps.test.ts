import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { splitWindows, toUtcSeconds, computeMetrics, pointSummary, isoFromSeconds } from '../gps/metrics';
import type { GpsPoint } from '../gps/types';

vi.mock('server-only', () => ({}));

const pt = (ts: number, odometerM: number | null, fuelUsedL: number | null): GpsPoint =>
  ({ ts, lat: 52.2, lng: 21, odometerM, fuelUsedL, fuelLevelPct: 50, ignition: true });

describe('gps metrics', () => {
  it('окна и даты', () => {
    expect(splitWindows(0, 100_000, 86_400)).toEqual([{ from: 0, to: 86_400 }, { from: 86_400, to: 100_000 }]);
    expect(splitWindows(5, 5, 10)).toEqual([]);
    expect(toUtcSeconds('2026-11-15', false)).toBe(Date.UTC(2026, 10, 15) / 1000);
    expect(toUtcSeconds('2026-11-15', true)).toBe(Date.UTC(2026, 10, 15, 23, 59, 59) / 1000);
    expect(toUtcSeconds('2026-11-15T10:00:00+05:00', false)).toBe(Date.UTC(2026, 10, 15) / 1000);
    expect(toUtcSeconds('x', false)).toBeNaN();
    expect(toUtcSeconds(null, true)).toBeNaN();
    expect(isoFromSeconds(0)).toBe('1970-01-01T00:00:00.000Z');
  });

  it('пробег, топливо, расход, одометр; нули и пустые показания пропускаются', () => {
    const m = computeMetrics([
      pt(3, 1_250_300_000, 400_120.5), pt(1, 1_250_000_000, 400_000), pt(2, 0, null), pt(4, null, 0),
    ]);
    expect(m).toEqual({ distanceKm: 300, fuelLiters: 120.5, consumption: 40.2, startOdometer: 1_250_000, endOdometer: 1_250_300 });
  });

  it('меньше двух показаний — нет данных', () => {
    expect(computeMetrics([pt(1, 1000, null)])).toEqual({ distanceKm: null, fuelLiters: null, consumption: null, startOdometer: null, endOdometer: null });
    expect(computeMetrics([])).toMatchObject({ distanceKm: null });
  });

  it('сводка точки — поля прежнего ответа (м, мл)', () => {
    expect(pointSummary(pt(Date.UTC(2026, 10, 15, 8, 5, 9), 1000, 1.5))).toEqual({
      time: '2026-11-15 08:05:09', totaldistance: 1000, totalfuel: 1500, fuellevelperc: 50, ignitionState: 'on', lat: 52.2, lng: 21,
    });
    expect(pointSummary(undefined)).toBeNull();
  });
});

// ── Logisat на заглушке ──
let server: http.Server;
const hits: string[] = [];
const frame = (h: number, dist: number, fuel: number) => ({
  dateTime: { year: 2026, month: 11, day: 15, hour: h, minute: 0, seconds: 0 },
  coordinate: { latitude: 52.1, longitude: 21.2 }, totaldistance: dist, totalfuel: fuel, fuellevelperc: 60, ignitionState: 1,
});

beforeAll(async () => {
  server = http.createServer((req, res) => {
    hits.push(req.url!);
    const m = /\/historyextended\/(\w+)\/(\d+)\/(\d+)\?password=(.*)$/.exec(req.url!);
    res.setHeader('Content-Type', 'application/json');
    if (!m || m[4] !== 'p%26ss') { res.statusCode = 401; return res.end('{}'); }
    if (m[1] === 'broken') { res.statusCode = 500; return res.end('{}'); }
    const from = Number(m[2]);
    // первое окно — объект с positionList, второе — массив
    if (from === Date.UTC(2026, 10, 15) / 1000) return res.end(JSON.stringify({ positionList: [frame(10, 2_000_000, 500_000), frame(1, 1_000_000, 100_000)] }));
    res.end(JSON.stringify([frame(23, 2_500_000, 650_000)]));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  Object.assign(process.env, {
    LOGISAT_API_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    LOGISAT_SERVER: 'x', LOGISAT_USERNAME: 'user', LOGISAT_PASSWORD: 'p&ss',
  });
});
afterAll(() => {
  server.close();
  for (const k of ['LOGISAT_API_URL', 'LOGISAT_SERVER', 'LOGISAT_USERNAME', 'LOGISAT_PASSWORD', 'GPS_PROVIDER']) delete process.env[k];
});

describe('logisat provider', () => {
  it('режет период на окна по 24 ч, собирает и сортирует точки, считает метрики', async () => {
    const { logisat } = await import('../gps/logisat');
    const from = Date.UTC(2026, 10, 15) / 1000;
    const track = await logisat.fetchTrack('dev1', from, from + 36 * 3600);
    expect(track).toMatchObject({ windows: 2, windowsOk: 2, windowsErr: 0 });
    expect(track.points.map((p) => p.odometerM)).toEqual([1_000_000, 2_000_000, 2_500_000]);
    expect(track.points[0]).toMatchObject({ lat: 52.1, lng: 21.2, fuelUsedL: 100, fuelLevelPct: 60, ignition: true });
    expect(computeMetrics(track.points)).toMatchObject({ distanceKm: 1500, fuelLiters: 550, consumption: 36.7 });
    expect(hits[0]).toContain('/atlas/user/historyextended/dev1/');
  }, 10_000);

  it('ошибки окон не роняют запрос', async () => {
    const { logisat } = await import('../gps/logisat');
    const track = await logisat.fetchTrack('broken', 0, 3600);
    expect(track).toMatchObject({ windows: 1, windowsOk: 0, windowsErr: 1, points: [] });
    expect(track.errors[0]).toContain('HTTP 500');
  });

  it('выбор GPS-сервиса', async () => {
    const { getGpsProvider } = await import('../gps');
    expect(getGpsProvider()?.id).toBe('logisat');
    process.env.GPS_PROVIDER = 'logisat';
    expect(getGpsProvider()?.name).toBe('Logisat');
    process.env.GPS_PROVIDER = 'webfleet';
    expect(getGpsProvider()).toBeNull();
    delete process.env.GPS_PROVIDER;
    const pw = process.env.LOGISAT_PASSWORD;
    delete process.env.LOGISAT_PASSWORD;
    expect(getGpsProvider()).toBeNull();
    process.env.LOGISAT_PASSWORD = pw;
  });
});
