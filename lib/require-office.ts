import 'server-only';

import { getActorContext } from './driver-access';
import { can, type Capability } from './roles';

/**
 * Проверка офисного доступа для server-actions.
 *
 * Зачем: почти все страницы ходят в базу через admin-клиент (service_role),
 * который RLS обходит. Проверка в proxy.ts по префиксу пути — единственный
 * барьер, и он односторонняя: как только действие вызывается с другой
 * страницы или новый путь не попал в PATH_CAPABILITIES — защита исчезает,
 * хотя код действия остаётся тем же.
 *
 * Поэтому каждое офисное действие проверяет роль САМ.
 * Роль берётся из profiles (lib/session.ts), а не из кук.
 *
 * Правило:
 *   - мутации офисных справочников и денег -> requireOffice();
 *   - действия по рейсу, где есть и водитель -> requireTripAccess(tripId).
 *
 * Фаза 39: добавлен requireCapability() — проверка конкретного права.
 * requireOffice() остаётся как requireCapability('office-only').
 * Так видно, какое именно право требуется, и менеджер (у которого
 * офисные права почти те же) отличается от офиса точечно.
 */
export async function requireOffice(): Promise<void> {
  const actor = await getActorContext();
  if (!actor.isOffice) {
    throw new Error('Нет доступа');
  }
}

/**
 * Проверка конкретного права для server-actions.
 *
 * Отличие от requireOffice(): менеджер по логистике имеет почти все
 * офисные права (см. MANAGER в lib/roles.ts), но не имеет export.view
 * и audit.view. Действия, которые должен уметь и менеджер, вызывают
 * requireCapability('trips.editAny') вместо requireOffice() — и тогда
 * право действительно различается, а не подменяется ролью.
 */
export async function requireCapability(capability: Capability): Promise<void> {
  const actor = await getActorContext();
  if (!can(actor.role, capability)) {
    throw new Error('Нет доступа');
  }
}
