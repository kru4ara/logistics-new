import type { createClient } from './supabase-server';

/**
 * Перенумеровывает все рейсы по start_date ASC.
 * Черновики (без start_date) попадают в конец, отсортированы по created_at ASC.
 * Дырок не остаётся: номера всегда идут 1..N.
 *
 * Двухфазная схема — сначала отрицательные, потом положительные.
 * Защищает от конфликта UNIQUE(trip_number), если такой индекс есть.
 * Самовосстанавливающаяся: если процесс упадёт между фазами,
 * следующий вызов снова приведёт всё в порядок.
 */
export async function renumberAllTrips(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<void> {
  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, trip_number, start_date, created_at')
    .order('start_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[renumber-trips] failed to load trips:', error.message);
    return;
  }

  if (!trips || trips.length === 0) return;

  const updates: { id: string; newNumber: number }[] = [];
  trips.forEach((t, idx) => {
    const expected = idx + 1;
    if (t.trip_number !== expected) {
      updates.push({ id: t.id, newNumber: expected });
    }
  });

  if (updates.length === 0) return;

  // Фаза 1: временно в отрицательные
  for (const u of updates) {
    await supabase
      .from('trips')
      .update({ trip_number: -u.newNumber })
      .eq('id', u.id);
  }

  // Фаза 2: финальные положительные
  for (const u of updates) {
    await supabase
      .from('trips')
      .update({ trip_number: u.newNumber })
      .eq('id', u.id);
  }
}
