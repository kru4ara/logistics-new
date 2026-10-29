import 'server-only';

import { getSessionContext } from './session';
import { normalizeRole } from './roles';
import { createClient as createRlsClient } from './supabase/server';
import {
  evaluateTripAccess,
  evaluateExpenseAccess,
  type ActorState,
} from './access-rules';

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
 * Приводит контекст актора к форме, которую ждут чистые правила
 * из lib/access-rules.ts.
 */
function toActorState(actor: ActorContext): ActorState {
  const role =
    actor.role === 'office' ? 'office' : actor.role === 'driver' ? 'driver' : null;
  return { role, driverId: actor.driverId };
}

/**
 * Владеет ли водитель рейсом.
 *
 * Фаза 38: водитель читает рейс через RLS-клиент, поэтому сама БД решает,
 * виден ли рейс. Политика trips_select_own_or_office опирается на
 * public.driver_owns_trip(), которая считает владением и рейс целиком,
 * и назначение хотя бы на один сегмент.
 *
 * Прежняя проверка в коде смотрела только на trips.driver_id и не знала
 * про сегментный случай — из-за этого водитель, назначенный на один
 * сегмент чужого рейса, получал отказ, хотя по БД рейс ему виден.
 */
export async function driverOwnsTrip(
  tripId: string,
  driverId: string
): Promise<boolean> {
  if (!tripId || !driverId) return false;

  const rls = await createRlsClient();
  const { data, error } = await rls
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .maybeSingle();

  if (error) {
    console.error(
      '[driver-access] чтение trips через RLS не удалось:',
      error.message
    );
    return false;
  }

  return Boolean(data);
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
  const state = toActorState(actor);

  if (state.role === 'office') return { ok: true };

  if (state.role !== 'driver' || !state.driverId) {
    return { ok: false, reason: 'Нет доступа' };
  }

  const owns = await driverOwnsTrip(tripId, state.driverId);
  return evaluateTripAccess(state, owns);
}

/**
 * Проверка доступа к расходу: расход принадлежит рейсу, а рейс — водителю.
 */
export async function requireExpenseAccess(
  expenseId: string
): Promise<AccessResult> {
  const actor = await getActorContext();
  const state = toActorState(actor);

  if (state.role === 'office') return { ok: true };

  if (state.role !== 'driver' || !state.driverId) {
    return { ok: false, reason: 'Нет доступа' };
  }

  const rls = await createRlsClient();
  const { data: expense, error } = await rls
    .from('trip_expenses')
    .select('id')
    .eq('id', expenseId)
    .maybeSingle();

  if (error) {
    console.error(
      '[driver-access] чтение trip_expenses через RLS не удалось:',
      error.message
    );
    return { ok: false, reason: 'Расход не найден' };
  }

  if (!expense) {
    return { ok: false, reason: 'Расход не найден' };
  }

  return evaluateExpenseAccess(state, true);
}
