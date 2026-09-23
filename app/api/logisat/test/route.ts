import { NextResponse, NextRequest } from 'next/server';

const SERVER = process.env.LOGISAT_SERVER;
const USERNAME = process.env.LOGISAT_USERNAME;
const PASSWORD = process.env.LOGISAT_PASSWORD;

// Разбивает период на окна по ≤24 часа (лимит API Logisat)
function splitIntoWindows(fromTs: number, toTs: number): Array<{ from: number; to: number }> {
  const MAX = 24 * 60 * 60; // 24 часа в секундах
  const windows: Array<{ from: number; to: number }> = [];
  let cursor = fromTs;

  while (cursor < toTs) {
    const end = Math.min(cursor + MAX, toTs);
    windows.push({ from: cursor, to: end });
    cursor = end;
  }

  return windows;
}

export async function GET(request: NextRequest) {
  if (!SERVER || !USERNAME || !PASSWORD) {
    return NextResponse.json(
      { success: false, error: 'LOGISAT_SERVER/USERNAME/PASSWORD не заданы' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get('deviceId') || '92677605162';
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  let fromTs: number;
  let toTs: number;

  if (fromParam && toParam) {
    fromTs = Math.floor(new Date(fromParam + 'T00:00:00Z').getTime() / 1000);
    toTs = Math.floor(new Date(toParam + 'T23:59:59Z').getTime() / 1000);
  } else {
    // По умолчанию — последние 2 часа
    const now = Math.floor(Date.now() / 1000);
    fromTs = now - 7200;
    toTs = now;
  }

  const windows = splitIntoWindows(fromTs, toTs);

  try {
    const allFrames: any[] = [];
    const windowResults: Array<{ from: number; to: number; count: number; error?: string }> = [];

    for (const w of windows) {
      const url = `https://${SERVER}/atlas/${USERNAME}/historyextended/${deviceId}/${w.from}/${w.to}?password=${PASSWORD}`;

      const res = await fetch(url, { cache: 'no-store' });

      if (!res.ok) {
        windowResults.push({ from: w.from, to: w.to, count: 0, error: `HTTP ${res.status}` });
        continue;
      }

      const data = await res.json();
      const positions = Array.isArray(data) ? data : (data.positionList || data.history || []);
      allFrames.push(...positions);
      windowResults.push({ from: w.from, to: w.to, count: positions.length });

      // Пауза между запросами, чтобы не заDDOSить Logisat
      await new Promise((r) => setTimeout(r, 200));
    }

    // Сортируем по времени
    allFrames.sort((a, b) => {
      const ta = a.dateTime ? new Date(Date.UTC(a.dateTime.year, a.dateTime.month - 1, a.dateTime.day, a.dateTime.hour, a.dateTime.minute, a.dateTime.seconds)).getTime() : 0;
      const tb = b.dateTime ? new Date(Date.UTC(b.dateTime.year, b.dateTime.month - 1, b.dateTime.day, b.dateTime.hour, b.dateTime.minute, b.dateTime.seconds)).getTime() : 0;
      return ta - tb;
    });

    const first = allFrames[0];
    const last = allFrames[allFrames.length - 1];

    function frameTime(f: any): string {
      if (!f?.dateTime) return '—';
      const d = f.dateTime;
      return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')} ${String(d.hour).padStart(2, '0')}:${String(d.minute).padStart(2, '0')}:${String(d.seconds).padStart(2, '0')}`;
    }

    // Расчёт пробега и топлива за период
    let distanceKm: number | null = null;
    let fuelLiters: number | null = null;

    if (first && last) {
      const distDiff = (last.totaldistance || 0) - (first.totaldistance || 0);
      const fuelDiff = (last.totalfuel || 0) - (first.totalfuel || 0);
      distanceKm = Math.round(distDiff / 100) / 10; // метры → км с 1 знаком
      fuelLiters = Math.round(fuelDiff / 100) / 10; // мл → л с 1 знаком
    }

    return NextResponse.json({
      success: true,
      deviceId,
      period: {
        from: new Date(fromTs * 1000).toISOString(),
        to: new Date(toTs * 1000).toISOString(),
        days: Math.round((toTs - fromTs) / 86400 * 10) / 10,
      },
      framesCount: allFrames.length,
      windowsCount: windows.length,
      windowResults,
      computed: {
        distanceKm,
        fuelLiters,
      },
      firstFrame: first ? {
        time: frameTime(first),
        totaldistance: first.totaldistance,
        totalfuel: first.totalfuel,
        fuellevelperc: first.fuellevelperc,
        ignitionState: first.ignitionState,
      } : null,
      lastFrame: last ? {
        time: frameTime(last),
        totaldistance: last.totaldistance,
        totalfuel: last.totalfuel,
        fuellevelperc: last.fuellevelperc,
        ignitionState: last.ignitionState,
      } : null,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
