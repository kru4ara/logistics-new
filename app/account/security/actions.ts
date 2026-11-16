'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '../../../lib/supabase/server';
import { createClient as createAdminClient } from '../../../lib/supabase/admin';
import { getSessionContext } from '../../../lib/session';
import { getT } from '../../../lib/i18n/server';
import { parseTotpCode } from '../../../lib/mfa-rules';
import { logAudit } from '../../../lib/audit';
import { isDriverRole } from '../../../lib/roles';

export type EnrollStart = { ok: boolean; factorId?: string; qr?: string; secret?: string; message?: string };

/** Начать подключение: новый TOTP-фактор (старые неподтверждённые — убираем). */
export async function startTotpEnroll(): Promise<EnrollStart> {
  const { t } = await getT();
  const { userId } = await getSessionContext();
  if (!userId) return { ok: false, message: t('mfa.error', { msg: 'auth' }) };
  const supabase = await createClient();
  const { data: list } = await supabase.auth.mfa.listFactors();
  for (const f of list?.all ?? []) {
    if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `CRM ${new Date().toISOString().slice(0, 10)}` });
  if (error || !data) {
    const msg = error?.message ?? '';
    return { ok: false, message: /disabled|not enabled/i.test(msg) ? t('mfa.notAvailable') : t('mfa.error', { msg }) };
  }
  return { ok: true, factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmTotpEnroll(factorId: string, rawCode: string): Promise<{ ok: boolean; message?: string }> {
  const { t } = await getT();
  const { userId } = await getSessionContext();
  if (!userId) return { ok: false, message: t('mfa.error', { msg: 'auth' }) };
  const code = parseTotpCode(rawCode);
  if (!code) return { ok: false, message: t('mfa.formatCode') };
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { ok: false, message: t('mfa.badCode') };
  await logAudit({ entity_type: 'user', entity_id: userId, action: 'update', summary: 'Включена двухфакторная защита входа' });
  revalidatePath('/account/security');
  return { ok: true };
}

/** Отключить свою 2FA (сессия уже aal2 — код вводили при входе). */
export async function disableTotp(): Promise<{ ok: boolean; message?: string }> {
  const { t } = await getT();
  const { userId, role } = await getSessionContext();
  if (!userId) return { ok: false, message: t('mfa.error', { msg: 'auth' }) };
  const admin = await createAdminClient();
  const { data: required } = await admin.rpc('staff_2fa_required');
  if (required === true && !isDriverRole(role)) return { ok: false, message: t('mfa.disableForbidden') };
  const supabase = await createClient();
  const { data: list } = await supabase.auth.mfa.listFactors();
  for (const f of list?.all ?? []) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) return { ok: false, message: t('mfa.error', { msg: error.message }) };
  }
  await logAudit({ entity_type: 'user', entity_id: userId, action: 'update', summary: 'Отключена двухфакторная защита входа' });
  revalidatePath('/account/security');
  return { ok: true };
}
