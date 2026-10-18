'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

export async function completeAdminOnboarding() {
  const cookieStore = await cookies();
  cookieStore.set('admin_onboarded', '1', {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 год
    sameSite: 'lax',
    httpOnly: false, // клиент может читать (для UX-подсказок)
  });
  revalidatePath('/');
}
