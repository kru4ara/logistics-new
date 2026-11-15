import 'server-only';
import type { createClient } from './supabase/admin';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Сумма в EUR по курсу таблицы rates на дату (последний курс не позже даты).
 * PLN и BYN — по курсу; EUR и неизвестные валюты — как есть (как и раньше в расходах).
 */
export async function toEur(supabase: Supabase, amount: number, currency: string | null, date: string): Promise<number> {
  const cur = (currency || 'EUR').toUpperCase();
  if (cur === 'EUR') return amount;
  const column = cur === 'PLN' ? 'pln_to_eur' : cur === 'BYN' ? 'byn_to_eur' : null;
  if (!column) return amount;
  const { data } = await supabase
    .from('rates')
    .select(column)
    .lte('rate_date', date)
    .order('rate_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  const rate = Number((data as Record<string, unknown> | null)?.[column]);
  const fallback = cur === 'PLN' ? 0.23 : 0.3;
  return Math.round(amount * (Number.isFinite(rate) && rate > 0 ? rate : fallback) * 100) / 100;
}
