'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireCapability } from '../lib/require-office';

/** Скрыть «Первые шаги» на главной (у этого пользователя, на год). */
export async function hideSetupChecklist() {
  await requireCapability('settings.edit');
  const cookieStore = await cookies();
  cookieStore.set('setup_hidden', '1', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  revalidatePath('/');
}
