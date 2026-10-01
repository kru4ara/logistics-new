import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Серверный клиент работает с service_role: полные права, обходит RLS.
// Использовать ТОЛЬКО на сервере (server components, route handlers, server actions).
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
