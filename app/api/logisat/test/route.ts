import { NextResponse, NextRequest } from 'next/server';

const SERVER = process.env.LOGISAT_SERVER;
const USERNAME = process.env.LOGISAT_USERNAME;
const PASSWORD = process.env.LOGISAT_PASSWORD;

export async function GET(request: NextRequest) {
  if (!SERVER || !USERNAME || !PASSWORD) {
    return NextResponse.json(
      { success: false, error: 'LOGISAT_SERVER/USERNAME/PASSWORD не заданы' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get('deviceId') || '92677605162';

  // Период: последние 2 часа
  const now = Math.floor(Date.now() / 1000);
  const twoHoursAgo = now - 7200;

  const url = `https://${SERVER}/atlas/${USERNAME}/historyextended/${deviceId}/${twoHoursAgo}/${now}?password=${PASSWORD}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, status: res.status, error: await res.text() },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Возвращаем только первые 3 кадра + мета-инфо
    const positions = Array.isArray(data) ? data : (data.positionList || data.history || []);
    const first = positions[0];
    const last = positions[positions.length - 1];

    return NextResponse.json({
      success: true,
      deviceId,
      fromTs: twoHoursAgo,
      toTs: now,
      framesCount: positions.length,
      firstFrame: first,
      lastFrame: last,
      totaldistance_first: first?.totaldistance,
      totaldistance_last: last?.totaldistance,
      totalfuel_first: first?.totalfuel,
      totalfuel_last: last?.totalfuel,
      sampleKeys: first ? Object.keys(first) : [],
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
