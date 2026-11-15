import { NextResponse, NextRequest } from 'next/server';
import { getSessionContext } from '../../../../lib/session';
import { can } from '../../../../lib/roles';
import { getGpsProvider } from '../../../../lib/gps';
import { computeMetrics, pointSummary } from '../../../../lib/gps/metrics';

// Служебная проверка GPS-сервиса компании: трек одного устройства за период
// (по умолчанию — последние 2 часа). Путь /api/logisat — исторический.
export async function GET(request: NextRequest) {
  const { role } = await getSessionContext();
  if (!can(role, 'logisat.sync')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const gps = getGpsProvider();
  if (!gps) {
    return NextResponse.json({ success: false, error: 'GPS is not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get('deviceId');
  if (!deviceId) return NextResponse.json({ success: false, error: 'deviceId is required' }, { status: 400 });
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const now = Math.floor(Date.now() / 1000);
  const fromTs = fromParam ? Math.floor(Date.parse(fromParam + 'T00:00:00Z') / 1000) : now - 7200;
  const toTs = toParam ? Math.floor(Date.parse(toParam + 'T23:59:59Z') / 1000) : now;
  if (!Number.isFinite(fromTs) || !Number.isFinite(toTs) || toTs <= fromTs) {
    return NextResponse.json({ success: false, error: 'bad period' }, { status: 400 });
  }

  try {
    const track = await gps.fetchTrack(deviceId, fromTs, toTs);
    const m = computeMetrics(track.points);
    return NextResponse.json({
      success: true,
      provider: gps.name,
      deviceId,
      period: {
        from: new Date(fromTs * 1000).toISOString(),
        to: new Date(toTs * 1000).toISOString(),
        days: Math.round(((toTs - fromTs) / 86400) * 10) / 10,
      },
      framesCount: track.points.length,
      windowsCount: track.windows,
      windowsOk: track.windowsOk,
      errors: track.errors.length ? track.errors : undefined,
      computed: { distanceKm: m.distanceKm, fuelLiters: m.fuelLiters },
      firstFrame: pointSummary(track.points[0]),
      lastFrame: pointSummary(track.points.at(-1)),
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
