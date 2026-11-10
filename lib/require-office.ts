import 'server-only';

import { getActorContext } from './driver-access';

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
 */
export async function requireOffice(): Promise<void> {
  const actor = await getActorContext();
  if (!actor.isOffice) {
    throw new Error('Нет доступа');
  }
}
