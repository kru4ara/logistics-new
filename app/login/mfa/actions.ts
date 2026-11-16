'use server';

import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { getSessionContext } from '../../../lib/session';
import { isDriverRole } from '../../../lib/roles';
import { getT } from '../../../lib/i18n/server';
import { parseTotpCode } from '../../../lib/mfa-rules';

/** Второй шаг входа: код TOTP → сессия aal2. */
export async function verifyMfaCode(_: { error?: string } | null, formData: FormData): Promise<{ error?: string }> {
  const { t } = await getT();
  const { userId, role } = await getSessionContext();
  if (!userId) redirect('/login');
  const code = parseTotpCode(formData.get('code'));
  if (!code) return { error: t('mfa.formatCode') };

  const supabase = await createClient();
  const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
  if (listErr) return { error: t('mfa.error', { msg: listErr.message }) };
  const factor = factors?.totp?.[0];
  if (!factor) redirect('/');
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { error: t('mfa.badCode') };
  redirect(isDriverRole(role) ? '/driver' : '/');
}
