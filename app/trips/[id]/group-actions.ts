'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../../lib/supabase/admin';
import { requireCapability } from '../../../lib/require-office';
import { requireTripAccess } from '../../../lib/driver-access';
import { logAudit } from '../../../lib/audit';
import { joinError } from '../../../lib/trip-groups';
import { getT } from '../../../lib/i18n/server';

type Result = { ok: true } | { ok: false; error: string };

async function guard(ids: string[]): Promise<string | null> {
  await requireCapability('trips.editAny');
  for (const id of ids) {
    const a = await requireTripAccess(id);
    if (!a.ok) return a.reason;
  }
  return null;
}

/** Присоединить заказ к сборному рейсу (ведущий — leaderId). */
export async function addToGroup(leaderId: string, memberId: string): Promise<Result> {
  const { t } = await getT();
  if (!leaderId || !memberId) return { ok: false, error: t('group.errNotFound') };
  const denied = await guard([leaderId, memberId]);
  if (denied) return { ok: false, error: denied };

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from('trips')
    .select('id, group_id, truck_id, status, trip_number')
    .in('id', [leaderId, memberId]);
  if (error) return { ok: false, error: error.message };
  const leader = rows?.find((r) => r.id === leaderId);
  const member = rows?.find((r) => r.id === memberId);
  if (!leader || !member) return { ok: false, error: t('group.errNotFound') };

  const { count } = await supabase
    .from('trip_segments')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', memberId);
  const err = joinError(leader, member, count || 0);
  if (err) return { ok: false, error: t(`group.err_${err}` as 'group.err_self') };

  if (!leader.group_id) {
    const { error: e1 } = await supabase.from('trips').update({ group_id: leaderId }).eq('id', leaderId);
    if (e1) return { ok: false, error: e1.message };
  }
  // Даты от ведущего копирует триггер trg_trip_group_dates (миграция 048).
  const { error: e2 } = await supabase.from('trips').update({ group_id: leaderId }).eq('id', memberId).is('group_id', null);
  if (e2) return { ok: false, error: e2.message };

  await logAudit({
    entity_type: 'trip',
    entity_id: memberId,
    action: 'update',
    changes: { group_id: { before: null, after: leaderId } },
    summary: `Сборный рейс: заказ №${member.trip_number ?? '—'} → ведущий №${leader.trip_number ?? '—'}`,
  });
  revalidatePath(`/trips/${leaderId}`);
  revalidatePath(`/trips/${memberId}`);
  revalidatePath('/trips');
  return { ok: true };
}

/** Убрать заказ из сборного рейса. Последний заказ ушёл — группа распадается. */
export async function removeFromGroup(memberId: string): Promise<Result> {
  const { t } = await getT();
  const denied = await guard([memberId]);
  if (denied) return { ok: false, error: denied };

  const supabase = await createClient();
  const { data: member } = await supabase.from('trips').select('id, group_id, trip_number').eq('id', memberId).maybeSingle();
  if (!member?.group_id || member.group_id === member.id) return { ok: false, error: t('group.errNotFound') };
  const leaderId = member.group_id as string;

  const { error } = await supabase.from('trips').update({ group_id: null }).eq('id', memberId);
  if (error) return { ok: false, error: error.message };

  const { count } = await supabase
    .from('trips')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', leaderId)
    .neq('id', leaderId);
  if (!count) await supabase.from('trips').update({ group_id: null }).eq('id', leaderId);

  await logAudit({
    entity_type: 'trip',
    entity_id: memberId,
    action: 'update',
    changes: { group_id: { before: leaderId, after: null } },
    summary: `Сборный рейс: заказ №${member.trip_number ?? '—'} убран из группы`,
  });
  revalidatePath(`/trips/${leaderId}`);
  revalidatePath(`/trips/${memberId}`);
  revalidatePath('/trips');
  return { ok: true };
}
