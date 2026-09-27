import { NextResponse, NextRequest } from 'next/server';
import { syncTripFromLogisat } from '../../../../lib/logisat';

export async function POST(request: NextRequest) {
  try {
    const SERVER = process.env.LOGISAT_SERVER;
    const USERNAME = process.env.LOGISAT_USERNAME;
    const PASSWORD = process.env.LOGISAT_PASSWORD;

    if (!SERVER || !USERNAME || !PASSWORD) {
      return NextResponse.json(
        {
          success: false,
          stage: 'env',
          error: 'Logisat не настроен. Проверь LOGISAT_SERVER, LOGISAT_USERNAME, LOGISAT_PASSWORD в Vercel.',
        },
        { status: 500 }
      );
    }

    let body: { tripId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, stage: 'body_parse', error: 'Неверный JSON в запросе' },
        { status: 400 }
      );
    }

    const tripId = body.tripId;
    if (!tripId) {
      return NextResponse.json(
        { success: false, stage: 'body_validate', error: 'tripId обязателен' },
        { status: 400 }
      );
    }

    const result = await syncTripFromLogisat(tripId);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    const e = err as Error;
    console.error('[logisat/sync] Exception:', e?.message, e?.stack);
    return NextResponse.json(
      { success: false, stage: 'unhandled', error: e?.message || 'Внутренняя ошибка' },
      { status: 500 }
    );
  }
}
