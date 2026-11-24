/**
 * Сборный рейс: несколько заказов (по клиенту на заказ, у каждого своя
 * фактура и оплата) в одной машине. Ведущий заказ везёт — у него машина,
 * водитель, участки и расходы; заказы группы — только клиент, груз, фрахт.
 * trips.group_id = id ведущего (у ведущего — его собственный id).
 * Даты группы копирует база (миграция 048).
 */

export type GroupTrip = {
  id: string;
  group_id: string | null;
  truck_id?: string | null;
  status?: string | null;
};

export type JoinError = 'self' | 'leaderInGroup' | 'memberInGroup' | 'memberHasTruck' | 'memberHasRoute' | 'cancelled';

/** Можно ли присоединить заказ member к сборному рейсу ведущего leader. */
export function joinError(leader: GroupTrip, member: GroupTrip, memberSegments: number): JoinError | null {
  if (leader.id === member.id) return 'self';
  // Ведущий не может сам быть заказом чужой группы.
  if (leader.group_id && leader.group_id !== leader.id) return 'leaderInGroup';
  if (member.group_id) return 'memberInGroup';
  if (member.status === 'cancelled' || leader.status === 'cancelled') return 'cancelled';
  if (member.truck_id) return 'memberHasTruck';
  if (memberSegments > 0) return 'memberHasRoute';
  return null;
}

export type GroupRow = { id: string; revenue_eur: number | null };

/** Экономика сборного рейса целиком: фрахт всех заказов − все расходы. */
export function groupEconomics(rows: GroupRow[], expensesByTrip: Record<string, number>) {
  const revenue = rows.reduce((s, r) => s + Number(r.revenue_eur || 0), 0);
  const expenses = rows.reduce((s, r) => s + Number(expensesByTrip[r.id] || 0), 0);
  return { revenue, expenses, profit: revenue - expenses, orders: rows.length };
}

/** Роль заказа в группе. */
export function groupRole(trip: GroupTrip): 'leader' | 'member' | null {
  if (!trip.group_id) return null;
  return trip.group_id === trip.id ? 'leader' : 'member';
}
