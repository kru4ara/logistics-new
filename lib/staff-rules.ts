/**
 * Сотрудники офиса (Настройки → Сотрудники): кто это и что с ними можно делать.
 * Чистые правила — тест lib/__tests__/staff-rules.test.ts. Возвращают коды,
 * текст подбирает страница (AGENTS.md, i18n, п. 3).
 */
import { normalizeRole, isOfficeRole } from './roles';

/** Роли, которые заводятся здесь. Менеджеры — в своём разделе, водители — в карточке водителя. */
export const STAFF_ROLES = ['office', 'accountant'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const isStaffRole = (v: unknown): v is StaffRole => (STAFF_ROLES as readonly string[]).includes(String(v));

/** Профиль относится к сотрудникам офиса (admin — старый офис). */
export const isStaffProfile = (role: string | null | undefined) => isStaffRole(normalizeRole(role));

export type StaffFormError = 'email' | 'password' | 'role' | 'name';

export function parseStaffForm(f: { email?: unknown; password?: unknown; role?: unknown; full_name?: unknown }):
  | { ok: true; email: string; password: string; role: StaffRole; fullName: string }
  | { ok: false; error: StaffFormError } {
  const email = String(f.email ?? '').trim().toLowerCase();
  const password = String(f.password ?? '');
  const fullName = String(f.full_name ?? '').trim();
  if (!fullName || fullName.length > 120) return { ok: false, error: 'name' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'email' };
  if (password.length < 8) return { ok: false, error: 'password' };
  if (!isStaffRole(f.role)) return { ok: false, error: 'role' };
  return { ok: true, email, password, role: f.role, fullName };
}

/**
 * Можно ли сменить роль / отключить доступ. Себя — нельзя (иначе офис сам
 * себя запрёт), и последнего офиса — нельзя (иначе настройки некому вести).
 */
export function staffChangeBlock(p: {
  actorId: string;
  targetId: string;
  targetRole: string | null;
  newRole: StaffRole | null;
  officeCount: number;
}): 'self' | 'lastOffice' | null {
  if (p.actorId === p.targetId) return 'self';
  if (isOfficeRole(p.targetRole) && !isOfficeRole(p.newRole) && p.officeCount <= 1) return 'lastOffice';
  return null;
}
