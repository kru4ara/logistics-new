import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

function pickName(rel: unknown): string {
  if (!rel) return '';
  if (Array.isArray(rel)) return rel[0]?.name || '';
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name || '';
  }
  return '';
}

/**
 * GET /api/trips/check-overlap?truckId=...&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&excludeTripId=...
 *
 * Проверяет, не пересекается ли рейс с другими рейсами той же машины.
 * endDate может быть пустым — тогда считаем как «в процессе» (бесконечно вправо).
 * excludeTripId — исключить из проверки сам редактируемый рейс.
 */
export async function GET(request: NextRequest) {
  const role = cookies().get('role')?.value;
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const truckId = searchParams.get('truckId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate') || null;
  const excludeTripId = searchParams.get('excludeTripId');

  if (!truckId || !startDate) {
    return NextResponse.json({
      success: true,
      conflicts: [],
      message: 'Недостаточно данных для проверки',
    });
  }

  const supabase = await createClient();

  // Все рейсы этой машины
  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, trip_number, start_date, end_date, status, route, clients(name)')
    .eq('truck_id', truckId);

  if (error) {
    console.error('[check-overlap] query failed:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  // Границы нового рейса
  const newStart = startDate;
  const newEnd = endDate || '9999-12-31'; // если финиша нет — бесконечно

  // Пересечение: существующий.s <= newEnd AND существующий.e >= newStart
  // Если у существующего end_date = null — считаем его как «в процессе»
  const conflicts = (trips || [])
    .filter((t: any) => {
      // Исключаем сам редактируемый рейс
      if (excludeTripId && t.id === excludeTripId) return false;
      // Исключаем рейсы без start_date (черновики) — они ничего не блокируют
      if (!t.start_date) return false;
      // Исключаем удалённые/отменённые статусы, если такие есть
      if (t.status === 'cancelled') return false;

      const existingStart = t.start_date;
      const existingEnd = t.end_date || '9999-12-31';

      return existingStart <= newEnd && existingEnd >= newStart;
    })
    .map((t: any) => ({
      id: t.id,
      trip_number: t.trip_number,
      start_date: t.start_date,
      end_date: t.end_date,
      status: t.status,
      route: t.route,
      client_name: pickName(t.clients),
    }))
    .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));

  return NextResponse.json({
    success: true,
    conflicts,
  });
}
