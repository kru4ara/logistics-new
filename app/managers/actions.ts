import 'server-only';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/admin';
import { requireCapability } from '../../lib/require-office';
import { managerProfileUpdate } from '../../lib/roles';
import { logAudit } from '../../lib/audit';
import { getSessionContext } from '../../lib/session';

/**
 * Экшены раздела «Менеджеры».
 *
 * Раздел доступен только офису: право managers.edit есть лишь у роли
 * office (см. MANAGER в lib/roles.ts). Менеджер сам себе менеджера
 * не назначает.
 */

export async function createManager(formData: FormData): Promise<void> {
  'use server';

  await requireCapability('managers.edit');

  const supabase = await createClient();

  const fullName = ((formData.get('full_name') as string) || '').trim();
  const phone = ((formData.get('phone') as string) || '').trim() || null;
  const email = ((formData.get('email') as string) || '').trim() || null;
  const telegramChatId = ((formData.get('telegram_chat_id') as string) || '').trim() || null;
  const notes = ((formData.get('notes') as string) || '').trim() || null;

  if (!fullName) throw new Error('Укажите имя менеджера');

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

  if (error) throw new Error(`Ошибка добавления: ${error.message}`);

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

  await requireCapability('managers.edit');

  const supabase = await createClient();

  const managerId = (formData.get('manager_id') as string) || '';
  const fullName = ((formData.get('full_name') as string) || '').trim();
  const phone = ((formData.get('phone') as string) || '').trim() || null;
  const email = ((formData.get('email') as string) || '').trim() || null;
  const telegramChatId = ((formData.get('telegram_chat_id') as string) || '').trim() || null;
  const notes = ((formData.get('notes') as string) || '').trim() || null;
  const active = formData.get('active') === 'true';

  if (!managerId) throw new Error('Менеджер не найден');
  if (!fullName) throw new Error('Укажите имя менеджера');

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

  if (error) throw new Error(`Ошибка сохранения: ${error.message}`);

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
 * Привязка учётной записи к карточке менеджера.
 *
 * Профиль (auth.users -> profiles) должен получить role='manager' и
 * manager_id = карточка. Без этого человек не сможет войти: роль
 * читается из profiles.
 */
/**
 * Задать или сменить пароль менеджера.
 *
 * Офис видит пароль в карточке и может его менять — поэтому здесь
 * пароль хранится открытым текстом (manager_passwords, RLS: только
 * офис) и одновременно выставляется в учётной записи Supabase Auth.
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

  await requireCapability('managers.edit');

  const supabase = await createClient();

  const managerId = (formData.get('manager_id') as string) || '';
  const email = ((formData.get('email') as string) || '').trim().toLowerCase();
  const password = (formData.get('password') as string) || '';

  if (!managerId) throw new Error('Менеджер не найден');
  if (!email || !email.includes('@')) {
    throw new Error('Укажите e-mail менеджера — это его логин в системе');
  }
  if (password.length < 6) {
    throw new Error('Пароль должен быть не короче 6 символов');
  }

  // Учётная запись: создаём, если её ещё нет.
  const { data: existingList, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    throw new Error(`Ошибка чтения учётных записей: ${listError.message}`);
  }

  const existing = (existingList?.users || []).find(
    (u) => (u.email || '').toLowerCase() === email
  );

  let userId = existing?.id || '';

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`Ошибка смены пароля: ${error.message}`);
  } else {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`Ошибка создания учётной записи: ${error.message}`);
    userId = created.user?.id || '';
  }

  if (!userId) throw new Error('Не удалось определить учётную запись');

  // Карточка: e-mail (он же логин), пароль и профиль.
  const { error: managerError } = await supabase
    .from('managers')
    .update({
      email,
      user_id: userId,
      password_updated_at: new Date().toISOString(),
    })
    .eq('id', managerId);
  if (managerError) throw new Error(`Ошибка сохранения карточки: ${managerError.message}`);

  const { error: passwordError } = await supabase
    .from('manager_passwords')
    .upsert(
      {
        manager_id: managerId,
        password,
        updated_at: new Date().toISOString(),
        updated_by: (await getSessionContext()).userId,
      },
      { onConflict: 'manager_id' }
    );
  if (passwordError) throw new Error(`Ошибка сохранения пароля: ${passwordError.message}`);

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
      throw new Error(`Ошибка создания профиля менеджера: ${insertError.message}`);
    }
  } else {
    const patch = managerProfileUpdate(profile.role, managerId);
    const { error: updateError } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId);
    if (updateError) {
      throw new Error(`Ошибка обновления профиля менеджера: ${updateError.message}`);
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

  await requireCapability('managers.edit');

  const supabase = await createClient();

  const managerId = (formData.get('manager_id') as string) || '';
  const userId = ((formData.get('user_id') as string) || '').trim();
  const email = ((formData.get('email') as string) || '').trim() || null;

  if (!managerId) throw new Error('Менеджер не найден');

  // e-mail карточки нужен для входа: по нему login ищет учётную запись.
  if (email) {
    const { error } = await supabase
      .from('managers')
      .update({ email, user_id: userId || null })
      .eq('id', managerId);
    if (error) throw new Error(`Ошибка сохранения: ${error.message}`);
  } else if (userId) {
    const { error } = await supabase
      .from('managers')
      .update({ user_id: userId })
      .eq('id', managerId);
    if (error) throw new Error(`Ошибка сохранения: ${error.message}`);
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
    if (readError) throw new Error(`Ошибка чтения профиля: ${readError.message}`);

    const patch = managerProfileUpdate(profile?.role, managerId);

    const { error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId);
    if (error) throw new Error(`Ошибка привязки профиля: ${error.message}`);
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
