/**
 * Подписи значений из базы (статусы и т. п.) → ключ перевода.
 * Значение в базе не переводится, переводится только подпись.
 */
import type { MessageKey } from './translate';

const TRIP_STATUS: Record<string, MessageKey> = {
  planned: 'status.planned',
  active: 'status.active',
  completed: 'status.completed',
  invoiced: 'status.invoiced',
  paid: 'status.paid',
};

/** Ключ подписи статуса заказа; неизвестный статус — null (показать как есть). */
export function tripStatusKey(status: string | null | undefined): MessageKey | null {
  return status ? TRIP_STATUS[status] ?? null : null;
}

export const TRIP_STATUSES = ['planned', 'active', 'completed', 'invoiced', 'paid'] as const;
