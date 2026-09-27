import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';
import { syncTripFromLogisat } from '../../../../lib/logisat';

export async function POST(request: NextRequest) {
  try {
    // Проверяем env
    const SERVER = process.env.LOGISAT_SERVER;
    const USERNAME = process.env.LOGISAT_USERNAME;
    const PASSWORD = process.env.LOGISAT_PASSWORD;

    if (!SERVER || !USERNAME || !PASSWORD) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Logisat не настроен. Проверь переменные окружения в Vercel: LOGISAT_SERVER, LOGISAT_USERNAME, LOGISAT_PASSWORD',
        },
        { status: 500 }
      );
    }

    // Парсим body
    let body: { tripId?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Неверный JSON в запросе' },
        { status: 400 }
      );
    }

    const tripId = body.tripId;
    if (!tripId) {
      return NextResponse.json(
        { success: false, error: 'tripId обязателен' },
        { status: 400 }
      );
    }

    // Вызываем helper
    const result = await syncTripFromLogisat(tripId);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    console.error('[logisat/sync] Exception:', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message || 'Внутренняя ошибка' },
      { status: 500 }
    );
  }
}
