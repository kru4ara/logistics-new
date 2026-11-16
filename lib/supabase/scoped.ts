import 'server-only';

import { createClient as createAdminClient } from './admin';
import { createClient as createRlsClient } from './server';
import { getScope } from '../scope';

/**
 * Клиент для чтения ЗАКАЗОВ и всего, что к ним относится (trips, trip_segments,
 * trip_expenses, trip_cargo, trip_documents, trip_segment_cargo).
 *
 *   менеджер — RLS-клиент: база сама отдаёт только его периметр (свои +
 *              неназначенные). Второй замок к фильтру в коде (lib/scope.ts):
 *              забытый фильтр больше не показывает чужие заказы.
 *   офис     — admin: офис видит всё, RLS ему ничего не даёт (AGENTS.md).
 *
 * Справочники (клиенты для выбора, грузовики, точки) читайте как раньше —
 * admin-клиентом: менеджер выбирает из всех, а не только из своих заказов.
 * Водительские страницы — свой RLS-клиент (app/driver/*).
 */
export async function scopedClient(): Promise<Awaited<ReturnType<typeof createAdminClient>>> {
  const scope = await getScope();
  // Типы клиентов совпадают по API; приводим к одному, чтобы страницы не ветвились.
  return scope.kind === 'manager'
    ? ((await createRlsClient()) as unknown as Awaited<ReturnType<typeof createAdminClient>>)
    : createAdminClient();
}
