import { NextResponse, NextRequest } from 'next/server';
import { getSessionContext } from '../../../../lib/session';
import { can } from '../../../../lib/roles';
import { getGpsProvider } from '../../../../lib/gps';
import { computeMetrics, pointSummary } from '../../../../lib/gps/metrics';

// Пробег и топливо по нескольким машинам за период — для страницы /logisat (GPS).
export async function POST(request: NextRequest) {
  const { role } = await getSessionContext();
  if (!can(role, 'logisat.view')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const gps = getGpsProvider();
  if (!gps) {
    return NextResponse.json({ success: false, error: 'GPS is not configured' }, { status: 500 });
  }

  let body: { deviceIds?: string[]; from?: string; to?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const { deviceIds, from, to } = body;
  if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
    return NextResponse.json({ success: false, error: 'deviceIds is required' }, { status: 400 });
  }
  if (!from || !to) {
    return NextResponse.json({ success: false, error: 'from and to are required' }, { status: 400 });
  }
  const fromTs = Math.floor(Date.parse(from + 'T00:00:00Z') / 1000);
  const toTs = Math.floor(Date.parse(to + 'T23:59:59Z') / 1000);
  if (!Number.isFinite(fromTs) || !Number.isFinite(toTs) || toTs <= fromTs) {
    return NextResponse.json({ success: false, error: 'bad period' }, { status: 400 });
  }

  const results = [];
  for (const deviceId of deviceIds.slice(0, 50)) {
    const track = await gps.fetchTrack(String(deviceId), fromTs, toTs);
    if (track.points.length === 0) {
      results.push({ deviceId, success: false, framesCount: 0, error: track.errors.join('; ') || 'no data for the period' });
      continue;
    }
    const m = computeMetrics(track.points);
    results.push({
      deviceId,
      success: true,
      framesCount: track.points.length,
      distanceKm: m.distanceKm ?? 0,
      fuelLiters: m.fuelLiters ?? 0,
      consumption: m.consumption ?? 0,
      firstFrame: pointSummary(track.points[0]),
      lastFrame: pointSummary(track.points.at(-1)),
      errors: track.errors.length ? track.errors : undefined,
    });
  }

  return NextResponse.json({
    success: true,
    provider: gps.name,
    period: {
      from: new Date(fromTs * 1000).toISOString(),
      to: new Date(toTs * 1000).toISOString(),
      days: Math.round((toTs - fromTs) / 8640) / 10,
    },
    count: results.length,
    results,
  });
}
