import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// ADMIN-клиент Supabase: работает с service_role — полные права, обходит RLS.
//
// ⚠️  Обходит Row Level Security. Любой авторизованный пользователь (в т.ч.
//     водитель) получает через этот клиент доступ ко всем таблицам.
//     Проверки прав сейчас делаются в коде приложения (см. lib/session.ts).
//
// Использовать ТОЛЬКО на сервере (server components, route handlers, server actions).
// Для запросов от имени пользователя — lib/supabase/server.ts (сессия + RLS).
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase не настроен: проверь NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в Vercel'
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
