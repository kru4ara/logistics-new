import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from './supabase/admin';
import { isTokenFormat } from './portal-rules';

export const hashToken = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');

/**
 * Токен ссылки → клиент. Неверный формат, неизвестный или отключённый токен — null
 * (без подсказок, что именно не так). Отмечает визит не чаще раза в 10 минут.
 */
export async function resolvePortal(token: string): Promise<{ clientId: string } | null> {
  if (!isTokenFormat(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('client_portal_links')
    .select('id, client_id, revoked_at, last_seen_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  const seen = Date.parse(data.last_seen_at ?? '');
  if (Number.isNaN(seen) || Date.now() - seen > 10 * 60_000) {
    await supabase.from('client_portal_links').update({ last_seen_at: new Date().toISOString() }).eq('id', data.id);
  }
  return { clientId: data.client_id as string };
}
