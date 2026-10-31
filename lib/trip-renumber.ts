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
    .select('id, trip_number, start_date, load_date, created_at, profit_mode')
    .order('start_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[renumber-trips] failed to load trips:', error.message);
    return;
  }

  if (!trips || trips.length === 0) return;

  // Сортировка внутри ветки нумерации — как в renumber_all_trips (БД):
  //   дата старта ASC (для экспедиции — дата загрузки),
  //   при равенстве дат — дата создания ASC, затем id ASC.
  const sorted = [...trips].sort((a: any, b: any) => {
    const da = a.start_date || a.load_date || null;
    const db = b.start_date || b.load_date || null;
    if (da && db && da !== db) return da < db ? -1 : 1;
    if (da && !db) return -1;
    if (!da && db) return 1;
    const ca = a.created_at || '';
    const cb = b.created_at || '';
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const updates: { id: string; newNumber: string }[] = [];
  let counterTrip = 0;
  let counterFwd = 0;

  sorted.forEach((t: any) => {
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
