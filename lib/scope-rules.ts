/**
 * Чистые правила скоупа — без Supabase и без 'server-only',
 * чтобы их можно было покрыть юнит-тестами.
 *
 * Фаза 39: вынесено из lib/scope.ts, где те же решения
 * принимались вперемешку с чтением сессии.
 */

export type Scope =
  /** Офис: видит все заказы. */
  | { kind: 'office' }
  /** Менеджер: свои заказы + неназначенные. */
  | { kind: 'manager'; managerId: string }
  /** Водитель: только свои заказы (фильтрует RLS, не эта функция). */
  | { kind: 'driver'; driverId: string | null };

/**
 * Менеджер ограничен своим периметром?
 *
 * Офис — нет. Водитель — нет (у него свой механизм, RLS).
 */
export function isScoped(scope: Scope): scope is { kind: 'manager'; managerId: string } {
  return scope.kind === 'manager';
}

/**
 * Фильтр заказов для менеджера в виде Supabase-условия.
 *
 * Возвращает строку для .or(...):
 *   manager_id.is.null,manager_id.eq.<id>
 *
 * То есть «без менеджера ИЛИ мой». Заказы, назначенные на другого
 * менеджера, условием не проходят.
 */
export function managerTripFilter(scope: Scope): string | null {
  if (scope.kind !== 'manager') return null;
  return `manager_id.is.null,manager_id.eq.${scope.managerId}`;
}

/**
 * Проверка по одной строке заказа — «входит ли она в мой периметр».
 *
 * Нужна там, где заказ приходит по id (карточка, action),
 * а не списком: там фильтр запроса не спасает.
 */
export function tripVisibleToScope(
  scope: Scope,
  trip: { manager_id?: string | null } | null | undefined
): boolean {
  if (scope.kind !== 'manager') return true;
  if (!trip) return false;
  if (!trip.manager_id) return true; // общий пул
  return trip.manager_id === scope.managerId;
}

/**
 * Идентификаторы заказов, которые актор имеет право видеть.
 *
 * Используется на поверхностях, где заказы приходят списком и
 * фильтруются в памяти (главная, /today, /map): там проще отфильтровать
 * уже прочитанный массив, чем городить дополнительные запросы.
 */
export function filterTripsByScope<T extends { manager_id?: string | null }>(
  scope: Scope,
  trips: T[]
): T[] {
  if (scope.kind !== 'manager') return trips;
  return trips.filter((t) => tripVisibleToScope(scope, t));
}
