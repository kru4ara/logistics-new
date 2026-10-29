// Разбор напоминаний на просроченные и приближающиеся.
// Вынесено из app/page.tsx (Фаза 40).

export type ReminderItem = {
  id: string;
  title: string;
  days: number;
};

export type ReminderRow = {
  id: string;
  title: string | null;
  due_date: string | null;
};

export function daysUntil(dateString: string | null): number | null {
  if (!dateString) return null;
  return Math.ceil((new Date(dateString).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/**
 * Делит напоминания на просроченные (days < 0) и приближающиеся (0..7).
 * Напоминания без даты пропускаются.
 */
export function splitReminders(
  rows: ReminderRow[] | null | undefined
): { expired: ReminderItem[]; soon: ReminderItem[] } {
  const expired: ReminderItem[] = [];
  const soon: ReminderItem[] = [];

  rows?.forEach((r) => {
    const d = daysUntil(r.due_date);
    if (d === null) return;
    if (d < 0) expired.push({ id: r.id, title: r.title || '', days: d });
    else if (d <= 7) soon.push({ id: r.id, title: r.title || '', days: d });
  });

  return { expired, soon };
}
