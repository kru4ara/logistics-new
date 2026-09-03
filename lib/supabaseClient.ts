import { createBrowserClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Старый клиент для всех файлов
export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

// Функция для логина
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
