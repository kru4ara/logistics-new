import { createClient } from './supabase/admin';
import { getSessionContext } from './session';

export type AuditAction = 'create' | 'update' | 'delete' | 'status_change' | 'merge';

export type AuditEntityType =
  | 'trip'
  | 'client'
  | 'driver'
  | 'contractor'
  | 'location'
  | 'forwarding_order'
  | 'trip_expense'
  | 'forwarding_expense'
  | 'document'
  | 'reminder'
  | 'driver_transaction';

type LogInput = {
  entity_type: AuditEntityType;
  entity_id: string;
  action: AuditAction;
  changes?: Record<string, { before: unknown; after: unknown }>;
  summary?: string;
};

/**
 * Пишет запись в audit_log.
 *
 * Не бросает исключений наружу — если логирование упало, бизнес-логика
 * продолжает работать. Ошибки пишутся в console.error и видны в Vercel Logs.
 */
export async function logAudit(input: LogInput): Promise<void> {
  try {
    const session = await getSessionContext();
    const role = session.role || 'unknown';
    const driverId = session.driverId || null;
    const userName =
      session.userName ||
      (role === 'admin' ? 'Офис' : role === 'driver' ? 'Водитель' : 'Неизвестно');

    const supabase = await createClient();

    const { error } = await supabase.from('audit_log').insert([
      {
        user_role: role,
        user_id: driverId,
        user_name: userName,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        action: input.action,
        changes: input.changes || null,
        summary: input.summary || null,
      },
    ]);

    if (error) {
      console.error('[audit] insert failed:', error.message, error.details, error.hint);
    }
  } catch (e) {
    console.error('[audit] exception:', e);
  }
}

/**
 * Сравнивает два объекта и возвращает только изменённые поля.
 * Используется для update-событий, чтобы не засорять лог.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fieldsToTrack: (keyof T)[]
): Record<string, { before: unknown; after: unknown }> {
  const changes: Record<string, { before: unknown; after: unknown }> = {};

  for (const field of fieldsToTrack) {
    const beforeVal = before[field];
    const afterVal = after[field];
    const beforeStr = beforeVal === null || beforeVal === undefined ? '' : String(beforeVal);
    const afterStr = afterVal === null || afterVal === undefined ? '' : String(afterVal);
    if (beforeStr !== afterStr) {
      changes[String(field)] = { before: beforeVal, after: afterVal };
    }
  }

  return changes;
}
