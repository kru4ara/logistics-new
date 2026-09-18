import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Это браузерный клиент (для всего, что работает на клиенте)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
