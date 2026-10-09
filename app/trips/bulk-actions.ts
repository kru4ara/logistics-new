'use server';

import { createClient } from '../../lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { logAudit } from '../../lib/audit';

// Статус «completed» (Завершён) сознательно не разрешён для массовой установки —
// он требует заполнения end_date (иначе «Рейсы за месяц» поедут). Меняйте точечно в карточке.
const ALLOWED_STATUSES = ['planned', 'active', 'invoiced', 'paid'] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

const STATUS_LABELS: Record<string, string> = {
  planned: 'Планируется',
  active: 'В пути',
  completed: 'Завершён',
  invoiced: 'Выставлен счёт',
  paid: 'Оплачен',
};

export async function bulkSetStatus(ids: string[], status: string) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false as const, error: 'Не выбрано ни одного рейса' };
  }
  if (!ALLOWED_STATUSES.includes(status as AllowedStatus)) {
    return {
      success: false as const,
      error: 'Этот статус нельзя установить массово — требуется дата финиша. Откройте рейс и завершите его отдельно.',
    };
  }

  const supabase = await createClient();

  const { data: before, error: fetchError } = await supabase
    .from('trips')
    .select('id, trip_number, status')
    .in('id', ids);

  if (fetchError) return { success: false as const, error: fetchError.message };

  const { error } = await supabase
    .from('trips')
    .update({ status })
    .in('id', ids);

  if (error) return { success: false as const, error: error.message };

  for (const t of before || []) {
    if (t.status === status) continue;
    await logAudit({
      entity_type: 'trip',
      entity_id: t.id,
      action: 'status_change',
      summary: `Рейс #${t.trip_number || '—'}: «${STATUS_LABELS[t.status] || t.status}» → «${STATUS_LABELS[status] || status}» (массово)`,
      changes: { status: { before: t.status, after: status } },
    });
  }

  revalidatePath('/trips');
  revalidatePath('/statistics');
  revalidatePath('/');
  revalidatePath('/today');

  return { success: true as const, count: ids.length };
}

export async function bulkDelete(ids: string[]) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false as const, error: 'Не выбрано ни одного рейса' };
  }

  const supabase = await createClient();

  const { data: before, error: fetchError } = await supabase
    .from('trips')
    .select('id, trip_number, revenue_eur')
    .in('id', ids);

  if (fetchError) return { success: false as const, error: fetchError.message };

  const { error } = await supabase
    .from('trips')
    .delete()
    .in('id', ids);

  if (error) return { success: false as const, error: error.message };

  for (const t of before || []) {
    await logAudit({
      entity_type: 'trip',
      entity_id: t.id,
      action: 'delete',
      summary: `Удалён рейс #${t.trip_number || '—'} (${t.revenue_eur || 0} €) — массово`,
    });
  }

  revalidatePath('/trips');
  revalidatePath('/statistics');
  revalidatePath('/');
  revalidatePath('/today');

  return { success: true as const, count: ids.length };
}
