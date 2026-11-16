'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireCapability } from '../../../lib/require-office';
import { createClient } from '../../../lib/supabase/admin';
import { getSessionContext } from '../../../lib/session';
import { logAudit } from '../../../lib/audit';
import { roleLabel, isOfficeRole, normalizeRole } from '../../../lib/roles';
import { isStaffRole, isStaffProfile, parseStaffForm, staffChangeBlock, type StaffRole } from '../../../lib/staff-rules';

type Admin = Awaited<ReturnType<typeof createClient>>;
const BACK = '/settings/users';
const BAN_FOREVER = '876000h';

async function findAuthUserByEmail(supabase: Admin, email: string) {
  const perPage = 200;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const found = data.users.find((u) => (u.email || '').toLowerCase() === email);
    if (found) return found;
    if (data.users.length < perPage) break;
  }
  return null;
}

async function officeCount(supabase: Admin): Promise<number> {
  const { data } = await supabase.from('profiles').select('role').in('role', ['office', 'admin']);
  return (data ?? []).filter((p) => isOfficeRole(p.role as string)).length;
}

/** Профиль сотрудника по id (только office/admin/accountant). */
async function staffProfile(supabase: Admin, userId: string) {
  const { data } = await supabase.from('profiles').select('id, role, full_name').eq('id', userId).maybeSingle();
  return data && isStaffProfile(data.role as string) ? data : null;
}

function back(params: Record<string, string>): never {
  redirect(`${BACK}?${new URLSearchParams(params).toString()}`);
}

/** Новый сотрудник офиса (или возврат отключённого — по тому же e-mail). */
export async function addStaff(formData: FormData): Promise<void> {
  await requireCapability('settings.edit');
  const parsed = parseStaffForm({
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role'),
  });
  if (!parsed.ok) back({ err: parsed.error });
  const { email, password, role, fullName } = parsed;
  const supabase = await createClient();

  let userId = '';
  try {
    const existing = await findAuthUserByEmail(supabase, email);
    if (existing) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', existing.id).maybeSingle();
      const r = normalizeRole(prof?.role as string | null);
      // Учётка водителя или менеджера — не трогаем: у них свои карточки.
      if (r && !isStaffRole(r)) back({ err: 'taken' });
      const { error } = await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true, ban_duration: 'none' });
      if (error) throw new Error(error.message);
      userId = existing.id;
    } else {
      const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw new Error(error.message);
      userId = data.user?.id ?? '';
    }
  } catch (e) {
    if (e && typeof e === 'object' && 'digest' in e) throw e; // redirect()
    back({ err: 'auth', msg: e instanceof Error ? e.message : String(e) });
  }

  // Профиль создаёт триггер при новой учётке (роль 'driver') — ставим нужную.
  const { error: pErr } = await supabase
    .from('profiles')
    .upsert({ id: userId, role, full_name: fullName, driver_id: null, manager_id: null }, { onConflict: 'id' });
  if (pErr) back(/profiles_role_check/.test(pErr.message) ? { err: 'migration' } : { err: 'auth', msg: pErr.message });

  await logAudit({
    entity_type: 'user',
    entity_id: userId,
    action: 'create',
    summary: `Сотрудник офиса ${email}: ${roleLabel(role)}`,
  });
  revalidatePath(BACK);
  back({ ok: 'added', email });
}

export async function setStaffRole(formData: FormData): Promise<void> {
  await requireCapability('settings.edit');
  const userId = String(formData.get('user_id') ?? '');
  const role = formData.get('role');
  if (!isStaffRole(role)) back({ err: 'role' });
  const supabase = await createClient();
  const target = await staffProfile(supabase, userId);
  if (!target) back({ err: 'auth', msg: 'not found' });
  const { userId: actorId } = await getSessionContext();
  const block = staffChangeBlock({
    actorId: actorId ?? '',
    targetId: userId,
    targetRole: target.role as string,
    newRole: role as StaffRole,
    officeCount: await officeCount(supabase),
  });
  if (block) back({ err: block });
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) back(/profiles_role_check/.test(error.message) ? { err: 'migration' } : { err: 'auth', msg: error.message });
  await logAudit({
    entity_type: 'user',
    entity_id: userId,
    action: 'update',
    summary: `Роль сотрудника ${target.full_name ?? userId}: ${roleLabel(target.role as string)} → ${roleLabel(role as string)}`,
  });
  revalidatePath(BACK);
  back({ ok: 'saved' });
}

export async function setStaffPassword(formData: FormData): Promise<void> {
  await requireCapability('settings.edit');
  const userId = String(formData.get('user_id') ?? '');
  const password = String(formData.get('password') ?? '');
  if (password.length < 8) back({ err: 'password' });
  const supabase = await createClient();
  const target = await staffProfile(supabase, userId);
  if (!target) back({ err: 'auth', msg: 'not found' });
  const { error } = await supabase.auth.admin.updateUserById(userId, { password });
  if (error) back({ err: 'auth', msg: error.message });
  await logAudit({ entity_type: 'user', entity_id: userId, action: 'update', summary: `Сменён пароль сотрудника ${target.full_name ?? userId}` });
  back({ ok: 'saved' });
}

/** Отключить доступ: роль снимается, учётная запись блокируется (сессии гаснут). */
export async function revokeStaff(formData: FormData): Promise<void> {
  await requireCapability('settings.edit');
  const userId = String(formData.get('user_id') ?? '');
  const supabase = await createClient();
  const target = await staffProfile(supabase, userId);
  if (!target) back({ err: 'auth', msg: 'not found' });
  const { userId: actorId } = await getSessionContext();
  const block = staffChangeBlock({
    actorId: actorId ?? '',
    targetId: userId,
    targetRole: target.role as string,
    newRole: null,
    officeCount: await officeCount(supabase),
  });
  if (block) back({ err: block });
  const { error: banErr } = await supabase.auth.admin.updateUserById(userId, { ban_duration: BAN_FOREVER });
  if (banErr) back({ err: 'auth', msg: banErr.message });
  await supabase.from('profiles').update({ role: null }).eq('id', userId);
  const { data: u } = await supabase.auth.admin.getUserById(userId);
  await logAudit({ entity_type: 'user', entity_id: userId, action: 'update', summary: `Отключён доступ сотрудника ${u.user?.email ?? userId}` });
  revalidatePath(BACK);
  back({ ok: 'revoked', email: u.user?.email ?? '' });
}
