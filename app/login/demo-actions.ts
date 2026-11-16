'use server';

import { resetDemo } from '../../lib/demo/reset';
import { isDemoMode } from '../../lib/demo/mode';
import { getT } from '../../lib/i18n/server';

/** Кнопка «Сбросить демо-данные» на странице входа (только DEMO_MODE, не чаще раза в 10 минут). */
export async function resetDemoNow(): Promise<{ ok: boolean; message: string }> {
  const { t } = await getT();
  if (!isDemoMode()) return { ok: false, message: t('demo.blocked') };
  const res = await resetDemo();
  if (res.ok) return { ok: true, message: t('demo.resetDone', { n: res.trips }) };
  if (res.reason === 'tooSoon') return { ok: false, message: t('demo.resetTooSoon') };
  return { ok: false, message: t('demo.resetFailed', { msg: res.message ?? res.reason }) };
}
