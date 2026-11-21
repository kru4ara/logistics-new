import 'server-only';
import type { createClient } from './supabase/admin';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Месяц рейса — по дате начала (как в отчётах), иначе по дате окончания. */
export const tripMonth = (t: { start_date?: string | null; end_date?: string | null } | null | undefined): string | null => {
  const d = t?.start_date ?? t?.end_date ?? null;
  return d ? String(d).slice(0, 7) : null;
};

/** Закрыт ли месяц. */
export async function isMonthClosed(supabase: Supabase, month: string | null): Promise<boolean> {
  if (!month) return false;
  const { data, error } = await supabase.from('closed_months').select('month').eq('month', month).maybeSingle();
  return !error && Boolean(data);
}
