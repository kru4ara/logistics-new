import 'server-only';
import { createClient } from './supabase/server';
import { createClient as createAdminClient } from './supabase/admin';

export type SessionContext = {
  userId: string | null;
  role: string | null;
  driverId: string | null;
  userName: string | null;
};

const EMPTY: SessionContext = {
  userId: null,
  role: null,
  driverId: null,
  userName: null,
};

/**
 * Единый источник роли и driver_id — таблица profiles.
 *
 * Куки role/driver_id — только совместимость с UI, они могут разойтись
 * с базой, поэтому источником правды считаем profiles.
 */
export async function getSessionContext(): Promise<SessionContext> {
  try {
    const authClient = await createClient();
    const { data } = await authClient.auth.getUser();
    const user = data?.user;
    if (!user) return EMPTY;

    const adminClient = await createAdminClient();
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, driver_id, full_name')
      .eq('id', user.id)
      .maybeSingle();

    return {
      userId: user.id,
      role: profile?.role ?? null,
      driverId: profile?.driver_id ?? null,
      userName: profile?.full_name ?? null,
    };
  } catch (e) {
    console.error('[session] getSessionContext failed:', e);
    return EMPTY;
  }
}
