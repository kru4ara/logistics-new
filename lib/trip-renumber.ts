import type { createClient } from './supabase/admin';
import { FORWARDING_SUFFIX, orderByNumberingDate } from './orders-core';

/**
 * Перенумеровывает все заказы по дате выгрузки ASC.
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
    .select('id, trip_number, start_date, end_date, load_date, unload_date, created_at, profit_mode')
    .order('end_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[renumber-trips] failed to load trips:', error.message);
    return;
  }

  if (!trips || trips.length === 0) return;

  // Сортировка внутри ветки нумерации — как в renumber_all_trips (БД):
  //   дата выгрузки ASC (рейс — финиш, экспедиция — разгрузка) СТРОГО,
  //   без запасного варианта start_date/load_date;
  //   при равенстве дат — дата создания ASC, затем id ASC;
  //   заказы без даты выгрузки (в пути) — в конец ветки.
  const sorted = [...trips].sort((a: any, b: any) => {
    // Единая функция сортировки нумерации (та же, что в БД):
    //   дата выгрузки ASC (рейс — финиш, экспедиция — разгрузка) СТРОГО,
    //   при равенстве — дата создания ASC,
    //   заказы без даты выгрузки (в пути) — в конец ветки.
    const byDate = orderByNumberingDate(a, b);
    if (byDate !== 0) return byDate;
    // Полный порядок — по id, чтобы нумерация была детерминированной.
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  // Заказ меняет ветку нумерации, если его текущий номер не совпадает
  // с режимом: экспедиция без суффикса 'Е' или рейс с суффиксом.
  // В этом случае пересобираются ЦЕЛИКОМ обе ветки — иначе номера
  // одной ветки сдвинутся и поедут по порядку.
  const hasFwdSuffix = (n: unknown) =>
    typeof n === 'string' && n.endsWith(FORWARDING_SUFFIX);
  const branchChanged = sorted.some(
    (t: any) => (t.profit_mode === 'forwarding') !== hasFwdSuffix(t.trip_number)
  );

  const updates: { id: string; newNumber: string }[] = [];
  let counterTrip = 0;
  let counterFwd = 0;

  sorted.forEach((t: any) => {
    const isForwarding = t.profit_mode === 'forwarding';
    const base = isForwarding ? ++counterFwd : ++counterTrip;
    const expected = isForwarding ? `${base}${FORWARDING_SUFFIX}` : String(base);
    if (branchChanged || t.trip_number !== expected) {
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
