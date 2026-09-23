import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';

const SERVER = process.env.LOGISAT_SERVER;
const USERNAME = process.env.LOGISAT_USERNAME;
const PASSWORD = process.env.LOGISAT_PASSWORD;

const MAX_WINDOW_SEC = 24 * 60 * 60;

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

function frameTimeStr(f: any): string {
  if (!f?.dateTime) return '—';
  const d = f.dateTime;
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')} ${String(d.hour).padStart(2, '0')}:${String(d.minute).padStart(2, '0')}`;
}

async function queryDevice(deviceId: string, fromTs: number, toTs: number) {
  const windows = splitIntoWindows(fromTs, toTs);
  const allFrames: any[] = [];
  const errors: string[] = [];

  for (const w of windows) {
    const url = `https://${SERVER}/atlas/${USERNAME}/historyextended/${deviceId}/${w.from}/${w.to}?password=${PASSWORD}`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        errors.push(`window ${w.from}-${w.to}: HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const positions = Array.isArray(data) ? data : (data.positionList || data.history || []);
      allFrames.push(...positions);
    } catch (e) {
      errors.push(`window ${w.from}-${w.to}: ${(e as Error).message}`);
    }
    // пауза, чтобы не спамить
    await new Promise((r) => setTimeout(r, 150));
  }

  if (allFrames.length === 0) {
    return {
      deviceId,
      success: false,
      error: errors.length > 0 ? errors.join('; ') : 'Нет данных за период',
      framesCount: 0,
    };
  }

  allFrames.sort((a, b) => frameDate(a) - frameDate(b));

  const first = allFrames[0];
  const last = allFrames[allFrames.length - 1];

  const distDiffM = (last.totaldistance || 0) - (first.totaldistance || 0);
  const fuelDiffMl = (last.totalfuel || 0) - (first.totalfuel || 0);

  const distanceKm = Math.max(0, Math.round(distDiffM / 100) / 10);
  const fuelLiters = Math.max(0, Math.round(fuelDiffMl / 100) / 10);
  const consumption = distanceKm > 0
    ? Math.round((fuelLiters / distanceKm) * 1000) / 10
    : 0;

  return {
    deviceId,
    success: true,
    framesCount: allFrames.length,
    distanceKm,
    fuelLiters,
    consumption,
    firstFrame: {
      time: frameTimeStr(first),
      totaldistance: first.totaldistance,
      totalfuel: first.totalfuel,
      fuellevelperc: first.fuellevelperc,
      ignitionState: first.ignitionState,
      lat: first.coordinate?.latitude,
      lng: first.coordinate?.longitude,
    },
    lastFrame: {
      time: frameTimeStr(last),
      totaldistance: last.totaldistance,
      totalfuel: last.totalfuel,
      fuellevelperc: last.fuellevelperc,
      ignitionState: last.ignitionState,
      lat: last.coordinate?.latitude,
      lng: last.coordinate?.longitude,
    },
    errors: errors.length > 0 ? errors : undefined,
  };
}

export async function POST(request: NextRequest) {
  if (!SERVER || !USERNAME || !PASSWORD) {
    return NextResponse.json(
      { success: false, error: 'Logisat не настроен (env переменные)' },
      { status: 500 }
    );
  }

  let body: { deviceIds?: string[]; from?: string; to?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Неверный JSON' }, { status: 400 });
  }

  const { deviceIds, from, to } = body;

  if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
    return NextResponse.json({ success: false, error: 'deviceIds обязателен' }, { status: 400 });
  }

  if (!from || !to) {
    return NextResponse.json({ success: false, error: 'from и to обязательны' }, { status: 400 });
  }

  const fromTs = Math.floor(new Date(from + 'T00:00:00Z').getTime() / 1000);
  const toTs = Math.floor(new Date(to + 'T23:59:59Z').getTime() / 1000);

  if (toTs <= fromTs) {
    return NextResponse.json({ success: false, error: 'Неверный период' }, { status: 400 });
  }

  const results = [];
  for (const deviceId of deviceIds) {
    const res = await queryDevice(deviceId, fromTs, toTs);
    results.push(res);
  }

  return NextResponse.json({
    success: true,
    period: {
      from: new Date(fromTs * 1000).toISOString(),
      to: new Date(toTs * 1000).toISOString(),
      days: Math.round((toTs - fromTs) / 8640) / 10,
    },
    count: results.length,
    results,
  });
}
