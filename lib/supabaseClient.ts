import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ============================================================
// БРАУЗЕРНЫЙ КЛИЕНТ (singleton)
// Используется в клиентских компонентах ('use client')
// ============================================================
let _browserClient: ReturnType<typeof createBrowserClient> | null = null;

function getBrowserClient() {
  if (!_browserClient) {
    _browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return _browserClient;
}

// ============================================================
// СЕРВЕРНЫЙ КЛИЕНТ (fresh per request)
// Используется в серверных компонентах и server actions
// ВАЖНО: НЕ кэшируется между запросами — иначе данные «застревают»
// ============================================================
function getServerClient() {
  const cookieStore = cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Server Component не позволяет set cookies — игнорируем
        }
      },
      remove(name: string, options: Record<string, unknown>) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch {
          // то же
        }
      },
    },
  });
}

type SupabaseClientType = ReturnType<typeof getBrowserClient>;

// ============================================================
// УНИВЕРСАЛЬНЫЙ ЭКСПОРТ
// Автоматически выбирает клиент по окружению.
// На сервере создаёт СВЕЖИЙ клиент на каждый вызов — это фиксит
// баг «застрявших» данных (когда в UI показывались старые записи).
// ============================================================
export const supabase = new Proxy({} as SupabaseClientType, {
  get(_target, prop) {
    const client =
      typeof window === 'undefined' ? getServerClient() : getBrowserClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
