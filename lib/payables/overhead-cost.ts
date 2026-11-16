import 'server-only';
import type { createClient } from '../supabase/admin';
import { toEur } from '../fx';
import { costAmount } from './cost-rules';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Строка «Общих расходов» из счёта (одна на счёт): есть — когда счёт «не относится к
 * рейсам» и у него выбрана категория накладных; иначе удаляется. Сумма — нетто (НДС
 * возвращается), месяц — по дате счёта. До миграции 038 — ничего не делает.
 */
export async function syncInvoiceOverheadCost(supabase: Supabase, invoiceId: string): Promise<void> {
  const { data: inv, error } = await supabase
    .from('purchase_invoices')
    .select('id, match_status, overhead_category, seller_name, invoice_number, net_amount, gross_amount, currency, issue_date')
    .eq('id', invoiceId)
    .maybeSingle();
  if (error) return;
  const { data: existing, error: exErr } = await supabase.from('fixed_costs').select('id').eq('purchase_invoice_id', invoiceId).maybeSingle();
  if (exErr) return;
  const wanted = inv && inv.match_status === 'ignored' && inv.overhead_category;
  if (!wanted) {
    if (existing) await supabase.from('fixed_costs').delete().eq('id', existing.id);
    return;
  }
  const amount = costAmount({
    net: inv.net_amount != null ? Number(inv.net_amount) : null,
    gross: inv.gross_amount != null ? Number(inv.gross_amount) : null,
  }) ?? 0;
  const date = String(inv.issue_date ?? new Date().toISOString()).slice(0, 10);
  const currency = (inv.currency || 'PLN').toUpperCase();
  const capex = inv.overhead_category === 'capex';
  const fields = {
    month_key: date.slice(0, 7),
    category: [inv.seller_name, inv.invoice_number].filter(Boolean).join(' · '),
    cost_type: 'one_time',
    expense_date: date,
    currency,
    original_amount: amount,
    amount_eur: await toEur(supabase, amount, currency, date),
    amount_pln: currency === 'PLN' ? amount : null,
    is_capex: capex,
    capex_rule: capex ? 'invoice' : 'none',
  };
  if (existing) await supabase.from('fixed_costs').update(fields).eq('id', existing.id);
  else await supabase.from('fixed_costs').insert({ ...fields, purchase_invoice_id: invoiceId });
}
