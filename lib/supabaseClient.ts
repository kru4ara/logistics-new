import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Объект для всех старых страниц (Driver, Trips, Clients и т.д.)
export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

// Функция для страницы входа (login)
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
