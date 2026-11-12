import 'server-only';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/admin';
import { requireCapability } from '../../lib/require-office';
import { managerProfileUpdate } from '../../lib/roles';
import { logAudit } from '../../lib/audit';

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
