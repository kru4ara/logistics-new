'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireCapability } from '../../lib/require-office';
import { createClient } from '../../lib/supabase/admin';
import { logAudit } from '../../lib/audit';
import { getT } from '../../lib/i18n/server';
import { getSessionContext } from '../../lib/session';
import { hashToken, newToken } from '../../lib/portal';

type Result = { ok: boolean; url?: string; message?: string };

async function baseUrl(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (env) return env.replace(/\/$/, '');
  const h = await headers();
  return `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
}

/** Новая ссылка портала клиента (прежняя отключается). Ссылку видно один раз. */
export async function createPortalLink(clientId: string): Promise<Result> {
  await requireCapability('clients.edit');
  const { t } = await getT();
  const supabase = await createClient();
  const { data: client } = await supabase.from('clients').select('id, name').eq('id', clientId).maybeSingle();
  if (!client) return { ok: false, message: t('portalAdm.notFound') };

  const now = new Date().toISOString();
  await supabase.from('client_portal_links').update({ revoked_at: now }).eq('client_id', clientId).is('revoked_at', null);
  const token = newToken();
  const session = await getSessionContext();
  const { error } = await supabase.from('client_portal_links').insert({
    client_id: clientId,
    token_hash: hashToken(token),
    created_by: session.userName ?? null,
  });
  if (error) {
    return { ok: false, message: /client_portal_links/.test(error.message) ? t('portalAdm.needMigration') : t('dir.addError', { msg: error.message }) };
  }
  await logAudit({ entity_type: 'client', entity_id: clientId, action: 'update', changes: {}, summary: `Создана ссылка портала клиента «${client.name}»` });
  revalidatePath(`/clients/${clientId}/edit`);
  return { ok: true, url: `${await baseUrl()}/portal/${token}` };
}

/** Отключить ссылку портала — по ней больше ничего не откроется. */
export async function revokePortalLink(clientId: string): Promise<Result> {
  await requireCapability('clients.edit');
  const { t } = await getT();
  const supabase = await createClient();
  const { error } = await supabase
    .from('client_portal_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .is('revoked_at', null);
  if (error) return { ok: false, message: t('dir.updateError', { msg: error.message }) };
  await logAudit({ entity_type: 'client', entity_id: clientId, action: 'update', changes: {}, summary: 'Ссылка портала клиента отключена' });
  revalidatePath(`/clients/${clientId}/edit`);
  return { ok: true };
}
