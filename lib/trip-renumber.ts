import type { createClient } from './supabase/admin';
import { FORWARDING_SUFFIX } from './orders-core';

/**
 * Перенумеровывает все заказы по дате старта ASC.
 * Черновики (без start_date) попадают в конец, отсортированы по id ASC.
 * Дырок не остаётся: номера всегда идут 1..N.
 *
 * Две независимые ветки нумерации:
 *   рейс        -> '42'
 *   экспедиция  -> '42Е'
 *
 * Двухфазная схема — сначала временные значения с префиксом '~',
 * потом финальные. Префикс '~' не встречается в реальных номерах,
 * поэтому финальная фаза всегда снимает возможный конфликт
 * UNIQUE(trip_number). Самовосстанавливающаяся: если процесс упадёт
 * между фазами, следующий вызов снова приведёт всё в порядок.
 */
export async function renumberAllTrips(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<void> {
  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, trip_number, start_date, load_date, profit_mode')
    .order('start_date', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true });

  if (error) {
    console.error('[renumber-trips] failed to load trips:', error.message);
    return;
  }

  if (!trips || trips.length === 0) return;

  const updates: { id: string; newNumber: string }[] = [];
  let counterTrip = 0;
  let counterFwd = 0;

  trips.forEach((t: any) => {
    const isForwarding = t.profit_mode === 'forwarding';
    const base = isForwarding ? ++counterFwd : ++counterTrip;
    const expected = isForwarding ? `${base}${FORWARDING_SUFFIX}` : String(base);
    if (t.trip_number !== expected) {
      updates.push({ id: t.id, newNumber: expected });
    }
  });

  if (updates.length === 0) return;

  // Фаза 1: временные значения с префиксом '~'
  for (const u of updates) {
    await supabase
      .from('trips')
      .update({ trip_number: `~${u.newNumber}` })
      .eq('id', u.id);
  }

  // Фаза 2: финальные номера
  for (const u of updates) {
    await supabase
      .from('trips')
      .update({ trip_number: u.newNumber })
      .eq('id', u.id);
  }
}
