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

/** Категории расходов, которые пользователь выбирает сам (без contractor и etoll). */
export const EXPENSE_CATEGORIES = [
  { value: 'fuel', emoji: '⛽' },
  { value: 'epi', emoji: '📄' },
  { value: 'border', emoji: '🛂' },
  { value: 'salary', emoji: '💶' },
  { value: 'manager_salary', emoji: '👔' },
  { value: 'permit', emoji: '📋' },
  { value: 'tlc', emoji: '🏭' },
  { value: 'waiting', emoji: '⏳' },
  { value: 'repair', emoji: '🔧' },
  { value: 'parking', emoji: '🅿️' },
  { value: 'disinfection', emoji: '🧴' },
  { value: 'ex1', emoji: '🧾' },
  { value: 'otkat', emoji: '🔄' },
  { value: 'gps_seal', emoji: '📡' },
  { value: 'other', emoji: '📌' },
] as const;

const EXPENSE_EMOJI: Record<string, string> = {
  ...Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c.emoji])),
  contractor: '🚛',
  etoll: '🛣',
};

const EXPENSE_KEYS = new Set<string>([...EXPENSE_CATEGORIES.map((c) => c.value), 'contractor', 'etoll']);

/** Ключ подписи категории расхода; неизвестная категория — null (показать как есть). */
export function expenseCategoryKey(category: string | null | undefined): MessageKey | null {
  return category && EXPENSE_KEYS.has(category) ? (`expenseCat.${category}` as MessageKey) : null;
}

/** Значок категории расхода (или пусто). */
export function expenseCategoryEmoji(category: string | null | undefined): string {
  return (category && EXPENSE_EMOJI[category]) || '';
}
