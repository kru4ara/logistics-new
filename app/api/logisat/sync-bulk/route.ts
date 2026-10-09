import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { syncTripFromLogisat } from '../../../../lib/logisat';

export const dynamic = 'force-dynamic';

// Параллельность — 3 синка одновременно.
// Logisat может не любить шквал запросов, поэтому батчами.
const CONCURRENCY = 3;

type SyncBulkResult = {
  tripId: string;
  success: boolean;
  error?: string;
  tripNumber?: number | null;
  distanceKm?: number;
  fuelLiters?: number;
};

async function processBatch(
  tripIds: string[]
): Promise<SyncBulkResult[]> {
  return Promise.all(
    tripIds.map(async (tripId) => {
      try {
        const result = await syncTripFromLogisat(tripId);
        return {
          tripId,
          success: result.success,
          error: result.error,
          tripNumber: result.tripNumber,
          distanceKm: result.distanceKm,
          fuelLiters: result.fuelLiters,
        };
      } catch (e) {
        return {
          tripId,
          success: false,
          error: (e as Error).message || 'Внутренняя ошибка',
        };
      }
    })
  );
}

export async function POST(request: NextRequest) {
  const role = cookies().get('role')?.value;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { tripIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Неверный JSON' },
      { status: 400 }
    );
  }

  const tripIds = Array.isArray(body.tripIds) ? body.tripIds : [];
  if (tripIds.length === 0) {
    return NextResponse.json(
      { success: false, error: 'tripIds пуст' },
      { status: 400 }
    );
  }

  try {
    const results: SyncBulkResult[] = [];
    for (let i = 0; i < tripIds.length; i += CONCURRENCY) {
      const batch = tripIds.slice(i, i + CONCURRENCY);
      const batchResults = await processBatch(batch);
      results.push(...batchResults);
    }

    const okCount = results.filter((r) => r.success).length;
    const failCount = results.length - okCount;

    return NextResponse.json({
      success: true,
      total: results.length,
      okCount,
      failCount,
      results,
    });
  } catch (e) {
    console.error('[logisat/sync-bulk] Exception:', e);
    return NextResponse.json(
      { success: false, error: (e as Error).message || 'Внутренняя ошибка' },
      { status: 500 }
    );
  }
}
