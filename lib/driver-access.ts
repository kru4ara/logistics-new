import 'server-only';

import { getSessionContext } from './session';
import { normalizeRole } from './roles';
import { createClient } from './supabase/admin';

export type ActorContext = {
  role: string;
  driverId: string | null;
  isOffice: boolean;
  isDriver: boolean;
};

/**
 * Контекст актора с нормализованной ролью.
 * В БД встречаются admin / manager / driver. Матрица прав в lib/roles.ts
 * оперирует ролями office / driver, поэтому admin и manager -> office.
 */
export async function getActorContext(): Promise<ActorContext> {
  const { role, driverId } = await getSessionContext();
  const normalized = normalizeRole(role);

  return {
    role: normalized,
    driverId,
    isOffice: normalized === 'office',
    isDriver: normalized === 'driver',
  };
}

/**
 * Владеет ли водитель рейсом.
 * В БД водитель рейса лежит в trips.driver_id -> drivers.id.
 */
export async function driverOwnsTrip(
  tripId: string,
  driverId: string
): Promise<boolean> {
  if (!tripId || !driverId) return false;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('trips')
    .select('driver_id')
    .eq('id', tripId)
    .maybeSingle();

  if (error || !data) return false;
  return data.driver_id === driverId;
}

export type AccessResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Проверка доступа к рейсу для server-actions.
 *
 * Зачем: actions принимают trip_id / tripId от клиента и пишут через
 * admin-клиент (service_role, RLS обходится). Без этой проверки водитель
 * мог подсунуть чужой tripId и изменить чужой рейс.
 *
 * Офис (office / admin / manager) имеет доступ ко всем рейсам.
 */
export async function requireTripAccess(tripId: string): Promise<AccessResult> {
  const actor = await getActorContext();

  if (actor.isOffice) return { ok: true };

  if (!actor.isDriver || !actor.driverId) {
    return { ok: false, reason: 'Нет доступа' };
  }

  const owns = await driverOwnsTrip(tripId, actor.driverId);
  if (!owns) {
    return { ok: false, reason: 'Рейс не принадлежит вам' };
  }

  return { ok: true };
}

/**
 * Проверка доступа к расходу: расход принадлежит рейсу, а рейс — водителю.
 */
export async function requireExpenseAccess(expenseId: string): Promise<AccessResult> {
  const actor = await getActorContext();

  if (actor.isOffice) return { ok: true };

  if (!actor.isDriver || !actor.driverId) {
    return { ok: false, reason: 'Нет доступа' };
  }

  const supabase = await createClient();
  const { data: expense, error } = await supabase
    .from('trip_expenses')
    .select('trip_id')
    .eq('id', expenseId)
    .maybeSingle();

  if (error || !expense?.trip_id) {
    return { ok: false, reason: 'Расход не найден' };
  }

  const owns = await driverOwnsTrip(expense.trip_id as string, actor.driverId);
  if (!owns) {
    return { ok: false, reason: 'Расход не принадлежит вам' };
  }

  return { ok: true };
}
