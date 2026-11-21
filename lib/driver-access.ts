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
  managerId: string | null;
  isOffice: boolean;
  isManager: boolean;
  isDriver: boolean;
};

/**
 * Контекст актора с нормализованной ролью.
 * В БД встречаются admin / manager / driver. Матрица прав в lib/roles.ts
 * оперирует ролями office / driver, поэтому admin и manager -> office.
 */
export async function getActorContext(): Promise<ActorContext> {
  const { role, driverId, managerId } = await getSessionContext();
  const normalized = normalizeRole(role);

  return {
    role: normalized,
    driverId,
    managerId,
    isOffice: normalized === 'office',
    isManager: normalized === 'manager',
    isDriver: normalized === 'driver',
  };
}

/**
 * Приводит контекст актора к форме, которую ждут чистые правила
 * из lib/access-rules.ts.
 */
function toActorState(actor: ActorContext): ActorState {
  const role =
    actor.role === 'office'
      ? 'office'
      : actor.role === 'manager'
        ? 'manager'
        : actor.role === 'driver'
          ? 'driver'
          : null;
  return { role, driverId: actor.driverId, managerId: actor.managerId };
}

/**
 * Виден ли рейс водителю (RLS) и его статус — закрытый рейс водитель не меняет.
 *
 * Владение решает БД: политика trips_select_own_or_office опирается на
 * public.driver_owns_trip() — рейс целиком или назначение хотя бы на один
 * сегмент. Не дублировать это правило в коде.
 */
async function driverTripState(tripId: string, driverId: string): Promise<{ visible: boolean; status: string | null }> {
  if (!tripId || !driverId) return { visible: false, status: null };

  const rls = await createRlsClient();
  const { data, error } = await rls
    .from('trips')
    .select('id, status')
    .eq('id', tripId)
    .maybeSingle();

  if (error) {
    console.error(
      '[driver-access] чтение trips через RLS не удалось:',
      error.message
    );
    return { visible: false, status: null };
  }

  return { visible: Boolean(data), status: (data?.status as string | null) ?? null };
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
 * Офис имеет доступ ко всем рейсам; менеджеру и водителю видимость считает база (RLS).
 */
export async function requireTripAccess(
  tripId: string,
  opts: { allowLocked?: boolean } = {}
): Promise<AccessResult> {
  const actor = await getActorContext();
  const state = toActorState(actor);

  if (state.role === 'office') return { ok: true };

  if (state.role === 'manager') {
    // Менеджер: заказ виден, если он его ведёт ИЛИ если менеджер
    // у заказа не назначен (общий пул офиса).
    const visible = await managerTripVisible(tripId);
    return evaluateTripAccess(state, visible);
  }

  if (state.role !== 'driver' || !state.driverId) {
    return { ok: false, reason: 'Нет доступа' };
  }

  const { visible, status } = await driverTripState(tripId, state.driverId);
  // allowLocked — догрузить документ (CMR-оригинал) в уже выставленный рейс можно.
  return evaluateTripAccess(state, visible, opts.allowLocked ? null : status);
}

/**
 * Виден ли заказ менеджеру — решает БАЗА (RLS-клиент от имени менеджера):
 * политика trips_select_own_or_office → manager_owns_trip() — свой заказ или
 * заказ без менеджера (общий пул). Правило не дублируется в коде (AGENTS.md):
 * при расхождении кода и БД менеджер получил бы доступ, которого база не даёт.
 */
export async function managerTripVisible(tripId: string): Promise<boolean> {
  if (!tripId) return false;
  const rls = await createRlsClient();
  const { data, error } = await rls.from('trips').select('id').eq('id', tripId).maybeSingle();
  if (error) {
    console.error('[driver-access] чтение trips (менеджер) через RLS не удалось:', error.message);
    return false;
  }
  return Boolean(data);
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

  // Менеджер и водитель: расход виден через RLS-клиент — значит, его заказ
  // в периметре (manager_owns_trip / driver_owns_trip решает база).
  if (state.role !== 'manager' && (state.role !== 'driver' || !state.driverId)) {
    return { ok: false, reason: 'Нет доступа' };
  }

  const rls = await createRlsClient();
  const { data: expense, error } = await rls
    .from('trip_expenses')
    .select('id, trips(status)')
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

  const t = (expense as { trips?: { status?: string | null } | { status?: string | null }[] | null }).trips;
  const tripStatus = (Array.isArray(t) ? t[0]?.status : t?.status) ?? null;
  return evaluateExpenseAccess(state, true, tripStatus);
}
