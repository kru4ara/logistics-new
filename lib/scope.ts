/**
 * Скоуп данных — что конкретный пользователь видит в заказах.
 *
 * Зачем отдельный слой, если есть capability (lib/roles.ts):
 *
 *   capability отвечает на вопрос «КУДА можно зайти» — менеджер имеет
 *   право открыть /trips, /statistics и т.д. Но он не отвечает на
 *   вопрос «ЧТО там увидеть». У офиса и менеджера разный ответ:
 *   офис видит все заказы, менеджер — только свои и неназначенные.
 *
 * Почему это не решается одной RLS-политикой: почти все страницы
 * ходят в базу через admin-клиент (service_role), который RLS
 * обходит. Политика в БД сработает только там, где читает RLS-клиент
 * (водительские страницы). Значит фильтр должен быть в коде — здесь.
 *
 * Правило менеджера (зафиксировано 11.11.2026):
 *   - заказ назначен на него        -> виден;
 *   - заказ без назначенного менеджера -> виден (общий пул офиса);
 *   - заказ назначен на другого менеджера -> НЕ виден.
 *
 * Чистые правила вынесены в lib/scope-rules.ts — там их покрывают
 * юнит-тесты без сервера.
 */

import 'server-only';

import { getSessionContext } from './session';
import { normalizeRole } from './roles';
import type { Scope } from './scope-rules';

export type { Scope };

/**
 * Скоуп текущего пользователя.
 *
 * Роль manager (менеджер по логистике) и office различаются именно
 * здесь: у менеджера есть manager_id, у офиса — нет.
 */
export async function getScope(): Promise<Scope> {
  const { role, driverId, managerId } = await getSessionContext();
  const normalized = normalizeRole(role);

  if (normalized === 'manager') {
    // Менеджер без привязанной карточки — трактуем как офис, чтобы он
    // не оказался в состоянии «не вижу вообще ничего».
    if (!managerId) return { kind: 'office' };
    return { kind: 'manager', managerId };
  }

  if (normalized === 'driver') {
    return { kind: 'driver', driverId };
  }

  return { kind: 'office' };
}
