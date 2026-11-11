import 'server-only';
import { createClient } from './supabase/server';
import { createClient as createAdminClient } from './supabase/admin';

export type SessionContext = {
  userId: string | null;
  role: string | null;
  driverId: string | null;
  /** Менеджер по логистике, которому назначен профиль. */
  managerId: string | null;
  userName: string | null;
};

const EMPTY: SessionContext = {
  userId: null,
  role: null,
  driverId: null,
  managerId: null,
  userName: null,
};

/**
 * Единый источник роли и driver_id — таблица profiles.
 *
 * Куки role/driver_id — только совместимость с UI, они могут разойтись
 * с базой, поэтому источником правды считаем profiles.
 *
 * Фаза 38: профиль читается через RLS-клиент (anon-ключ + сессия),
 * а не через admin-клиент (service_role). Политика
 * profiles_select_own_or_office разрешает читать строку с id = auth.uid()
 * любому авторизованному пользователю, поэтому поведение не меняется —
 * но источник больше не обходит RLS.
 *
 * Если профиль через RLS не прочитался (политика не применена, миграция
 * не залита, сессия сломана), делаем откат на admin-клиент: подрядчику
 * лучше показать рабочее приложение, чем отправить в /login. Откат
 * читает СТРОГО одну строку по id = user.id — расширения прав это не даёт.
 */
/**
 * Ошибка «колонки нет» (42703 / undefined_column).
 *
 * Возникает, когда миграция с новой колонкой ещё не применена.
 */
function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = String(error.code ?? '');
  const message = String(error.message ?? '').toLowerCase();
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    message.includes('does not exist') ||
    message.includes('manager_id')
  );
}

export async function getSessionContext(): Promise<SessionContext> {
  try {
    const authClient = await createClient();
    const { data } = await authClient.auth.getUser();
    const user = data?.user;
    if (!user) return EMPTY;

    const { data: profile, error } = await authClient
      .from('profiles')
      .select('role, driver_id, manager_id, full_name')
      .eq('id', user.id)
      .maybeSingle();

    if (!error && profile) {
      return {
        userId: user.id,
        role: profile.role ?? null,
        driverId: profile.driver_id ?? null,
        managerId: profile.manager_id ?? null,
        userName: profile.full_name ?? null,
      };
    }

    // Миграция 012 ещё не применена — колонки profiles.manager_id нет,
    // и запрос падает с 42703. Тогда читаем профиль БЕЗ manager_id:
    // приложение обязано работать и до применения миграции, иначе
    // пользователь уходит в бесконечный цикл редиректов
    // (/ -> /driver -> /login -> /), потому что роль не читается.
    if (error && isMissingColumn(error)) {
      const { data: baseProfile } = await authClient
        .from('profiles')
        .select('role, driver_id, full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (baseProfile) {
        return {
          userId: user.id,
          role: baseProfile.role ?? null,
          driverId: baseProfile.driver_id ?? null,
          managerId: null,
          userName: baseProfile.full_name ?? null,
        };
      }
    }

    console.error(
      '[session] профиль через RLS не прочитан, откат на admin:',
      error?.message ?? 'строка не найдена'
    );

    const adminClient = await createAdminClient();
    const { data: adminProfile, error: adminError } = await adminClient
      .from('profiles')
      .select('role, driver_id, manager_id, full_name')
      .eq('id', user.id)
      .maybeSingle();

    if (!adminError && adminProfile) {
      return {
        userId: user.id,
        role: adminProfile.role ?? null,
        driverId: adminProfile.driver_id ?? null,
        managerId: adminProfile.manager_id ?? null,
        userName: adminProfile.full_name ?? null,
      };
    }

    // Тот же случай: колонки manager_id ещё нет в БД.
    const { data: baseProfile } = await adminClient
      .from('profiles')
      .select('role, driver_id, full_name')
      .eq('id', user.id)
      .maybeSingle();

    return {
      userId: user.id,
      role: baseProfile?.role ?? null,
      driverId: baseProfile?.driver_id ?? null,
      managerId: null,
      userName: baseProfile?.full_name ?? null,
    };
  } catch (e) {
    console.error('[session] getSessionContext failed:', e);
    return EMPTY;
  }
}
