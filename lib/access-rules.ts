/**
 * Чистые правила доступа — без Supabase и без 'server-only',
 * чтобы их можно было покрыть юнит-тестами.
 *
 * Фаза 38: вынесено из lib/driver-access.ts, где те же решения
 * принимались вперемешку с запросами к базе.
 */

export type ActorRole = 'office' | 'driver';

export type ActorState = {
  role: ActorRole | null;
  driverId: string | null;
};

/**
 * Владеет ли актор рейсом.
 *
 * Совпадает с политикой БД public.driver_owns_trip(): водитель владеет
 * рейсом, если назначен на рейс целиком ИЛИ хотя бы на один его сегмент.
 *
 * tripVisible — результат чтения рейса через RLS-клиент. Для водителя
 * политика trips_select_own_or_office пропускает только «свои» рейсы,
 * поэтому наличие строки и есть проверка владения на уровне БД.
 */
export function actorOwnsTrip(
  actor: ActorState,
  tripVisible: boolean
): boolean {
  if (actor.role === 'office') return true;
  if (actor.role !== 'driver') return false;
  if (!actor.driverId) return false;
  return tripVisible;
}

/**
 * Доступ к рейсу для server-actions.
 *
 * Офис (office / admin / manager) имеет доступ ко всем рейсам.
 */
export function evaluateTripAccess(
  actor: ActorState,
  tripVisible: boolean
): { ok: true } | { ok: false; reason: string } {
  if (actor.role === 'office') return { ok: true };

  if (actor.role !== 'driver' || !actor.driverId) {
    return { ok: false, reason: 'Нет доступа' };
  }

  if (!tripVisible) {
    return { ok: false, reason: 'Рейс не принадлежит вам' };
  }

  return { ok: true };
}

/**
 * Доступ к расходу: расход принадлежит рейсу, а рейс — водителю.
 *
 * expenseVisible — результат чтения расхода через RLS-клиент. Политика
 * trip_expenses_select_own_or_office пропускает расходы только по
 * «своим» рейсам, поэтому наличие строки означает, что расход
 * принадлежит водителю.
 */
export function evaluateExpenseAccess(
  actor: ActorState,
  expenseVisible: boolean
): { ok: true } | { ok: false; reason: string } {
  if (actor.role === 'office') return { ok: true };

  if (actor.role !== 'driver' || !actor.driverId) {
    return { ok: false, reason: 'Нет доступа' };
  }

  if (!expenseVisible) {
    return { ok: false, reason: 'Расход не принадлежит вам' };
  }

  return { ok: true };
}
