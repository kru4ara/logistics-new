import 'server-only';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/admin';
import { requireCapability } from '../../lib/require-office';
import { managerProfileUpdate } from '../../lib/roles';
import { logAudit } from '../../lib/audit';
import { getT } from '../../lib/i18n/server';

/**
 * Экшены раздела «Менеджеры».
 *
 * Раздел доступен только офису: право managers.edit есть лишь у роли
 * office (см. MANAGER в lib/roles.ts). Менеджер сам себе менеджера
 * не назначает.
 */

export async function createManager(formData: FormData): Promise<void> {
  'use server';
  const { t } = await getT();

  await requireCapability('managers.edit');

  const supabase = await createClient();

  const fullName = ((formData.get('full_name') as string) || '').trim();
  const phone = ((formData.get('phone') as string) || '').trim() || null;
  const email = ((formData.get('email') as string) || '').trim() || null;
  const telegramChatId = ((formData.get('telegram_chat_id') as string) || '').trim() || null;
  const notes = ((formData.get('notes') as string) || '').trim() || null;

  if (!fullName) throw new Error(t('mgr.needName'));

  const { data, error } = await supabase
    .from('managers')
    .insert([
      {
        full_name: fullName,
        phone,
        email,
        telegram_chat_id: telegramChatId,
        notes,
      },
    ])
    .select('id')
    .single();

  if (error) throw new Error(t('dir.addError', { msg: error.message }));

  if (data?.id) {
    await logAudit({
      entity_type: 'manager',
      entity_id: data.id,
      action: 'create',
      summary: `Создан менеджер «${fullName}»`,
    });
  }

  revalidatePath('/managers');
  redirect('/managers');
}

export async function updateManager(formData: FormData): Promise<void> {
  'use server';
  const { t } = await getT();

  await requireCapability('managers.edit');

  const supabase = await createClient();

  const managerId = (formData.get('manager_id') as string) || '';
  const fullName = ((formData.get('full_name') as string) || '').trim();
  const phone = ((formData.get('phone') as string) || '').trim() || null;
  const email = ((formData.get('email') as string) || '').trim() || null;
  const telegramChatId = ((formData.get('telegram_chat_id') as string) || '').trim() || null;
  const notes = ((formData.get('notes') as string) || '').trim() || null;
  const active = formData.get('active') === 'true';

  if (!managerId) throw new Error(t('mgr.notFound'));
  if (!fullName) throw new Error(t('mgr.needName'));

  const { error } = await supabase
    .from('managers')
    .update({
      full_name: fullName,
      phone,
      email,
      telegram_chat_id: telegramChatId,
      notes,
      active,
    })
    .eq('id', managerId);

  if (error) throw new Error(t('mgr.errSave', { msg: error.message }));

  await logAudit({
    entity_type: 'manager',
    entity_id: managerId,
    action: 'update',
    summary: `Изменён менеджер «${fullName}»`,
  });

  revalidatePath('/managers');
  revalidatePath(`/managers/${managerId}`);
  redirect(`/managers/${managerId}`);
}

/**
 * Ищет учётную запись Auth по e-mail с постраничным обходом.
 * listUsers() без параметров отдаёт только первую страницу (~50 записей),
 * и при росте базы createUser падал бы с «already registered».
 */
async function findAuthUserByEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string
) {
  const { t } = await getT();
  const perPage = 200;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(t('mgr.errReadAccounts', { msg: error.message }));
    const found = data.users.find((u) => (u.email || '').toLowerCase() === email);
    if (found) return found;
    if (data.users.length < perPage) break;
  }
  return null;
}

/**
 * Привязка учётной записи к карточке менеджера.
 *
 * Профиль (auth.users -> profiles) должен получить role='manager' и
 * manager_id = карточка. Без этого человек не сможет войти: роль
 * читается из profiles.
 */
/**
 * Задать или сменить пароль менеджера.
 *
 * Пароль выставляется в учётной записи Supabase Auth (там хранится
 * только хэш) и нигде больше не сохраняется и не показывается.
 * Забыл пароль — офис задаёт новый.
 *
 * Что происходит:
 *   1. e-mail карточки — это логин: именно по нему человек входит.
 *      Учётная запись создаётся, если её ещё нет.
 *   2. Пароль обновляется в auth.users.
 *   3. Создаётся (или обновляется) профиль profiles с ролью
 *      'manager' и ссылкой manager_id на карточку.
 *
 * Триггер trg_profiles_manager_needs_card требует manager_id при
 * role='manager' — поэтому роль и ссылку ставим одним UPDATE.
 *
 * Если учётная запись уже существует с другим e-mail — пароль
 * обновится в ней, а карточка будет указывать на новый e-mail.
 */
export async function setManagerPassword(formData: FormData): Promise<void> {
  'use server';
  const { t } = await getT();

  await requireCapability('managers.edit');

  const supabase = await createClient();

  const managerId = (formData.get('manager_id') as string) || '';
  const email = ((formData.get('email') as string) || '').trim().toLowerCase();
  const password = (formData.get('password') as string) || '';

  if (!managerId) throw new Error(t('mgr.notFound'));
  if (!email || !email.includes('@')) {
    throw new Error(t('mgr.needEmail'));
  }
  if (password.length < 6) {
    throw new Error(t('mgr.passShort'));
  }

  // Учётная запись: создаём, если её ещё нет.
  const existing = await findAuthUserByEmail(supabase, email);

  let userId = existing?.id || '';

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw new Error(t('mgr.errPassword', { msg: error.message }));
  } else {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(t('mgr.errCreateAccount', { msg: error.message }));
    userId = created.user?.id || '';
  }

  if (!userId) throw new Error(t('mgr.noAccount'));

  // Карточка: e-mail (он же логин) и дата смены пароля. Сам пароль
  // нигде не хранится — только в Supabase Auth (хэш).
  const { error: managerError } = await supabase
    .from('managers')
    .update({
      email,
      user_id: userId,
      password_updated_at: new Date().toISOString(),
    })
    .eq('id', managerId);
  if (managerError) throw new Error(t('mgr.errSaveCard', { msg: managerError.message }));

  // Профиль менеджера: роль 'manager' + ссылка на карточку.
  //
  // Если профиля нет — создаём. Если есть — обновляем роль и ссылку.
  // Роль ставим только если профиль НЕ офисный: офис, который сам
  // себе назначил менеджера, не должен терять доступ к админским
  // разделам (см. managerProfileUpdate в lib/roles.ts).
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ id: userId, role: 'manager', manager_id: managerId });
    if (insertError) {
      throw new Error(t('mgr.errCreateProfile', { msg: insertError.message }));
    }
  } else {
    const patch = managerProfileUpdate(profile.role, managerId);
    const { error: updateError } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId);
    if (updateError) {
      throw new Error(t('mgr.errUpdateProfile', { msg: updateError.message }));
    }
  }

  await logAudit({
    entity_type: 'manager',
    entity_id: managerId,
    action: 'update',
    summary: existing
      ? 'Сменён пароль менеджера'
      : 'Создана учётная запись менеджера и задан пароль',
  });

  revalidatePath(`/managers/${managerId}`);
  redirect(`/managers/${managerId}`);
}

export async function linkManagerUser(formData: FormData): Promise<void> {
  'use server';
  const { t } = await getT();

  await requireCapability('managers.edit');

  const supabase = await createClient();

  const managerId = (formData.get('manager_id') as string) || '';
  const userId = ((formData.get('user_id') as string) || '').trim();
  const email = ((formData.get('email') as string) || '').trim() || null;

  if (!managerId) throw new Error(t('mgr.notFound'));

  // e-mail карточки нужен для входа: по нему login ищет учётную запись.
  if (email) {
    const { error } = await supabase
      .from('managers')
      .update({ email, user_id: userId || null })
      .eq('id', managerId);
    if (error) throw new Error(t('mgr.errSave', { msg: error.message }));
  } else if (userId) {
    const { error } = await supabase
      .from('managers')
      .update({ user_id: userId })
      .eq('id', managerId);
    if (error) throw new Error(t('mgr.errSave', { msg: error.message }));
  }

  if (userId) {
    // Роль понижаем до 'manager' только если профиль сейчас не офисный.
    //
    // Иначе можно потерять доступ к админским разделам: у роли
    // 'manager' нет managers.view/managers.edit, audit.view и
    // export.view (см. MANAGER в lib/roles.ts). Если менеджера
    // привязывают к учётной записи, которая одновременно является
    // рабочей офисной, профиль не должен терять офисные права —
    // иначе он больше не сможет ни отвязать себя, ни открыть
    // раздел «Менеджеры».
    //
    // Ссылка на карточку (manager_id) проставляется в любом случае:
    // по ней определяется скоуп менеджера в lib/scope.ts.
    const { data: profile, error: readError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    if (readError) throw new Error(t('mgr.errReadProfile', { msg: readError.message }));

    const patch = managerProfileUpdate(profile?.role, managerId);

    const { error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId);
    if (error) throw new Error(t('mgr.errLinkProfile', { msg: error.message }));
  }

  await logAudit({
    entity_type: 'manager',
    entity_id: managerId,
    action: 'update',
    summary: 'Привязана учётная запись к менеджеру',
  });

  revalidatePath(`/managers/${managerId}`);
  redirect(`/managers/${managerId}`);
}
