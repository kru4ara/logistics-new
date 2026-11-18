// Общие расходы: ручная запись, повторяющая счёт из KSeF, — чистые правила (тесты).

export type CostForDup = {
  id: string;
  month_key: string | null;
  expense_date: string | null;
  category: string | null;
  currency: string | null;
  original_amount: number | null;
  /** у записи из счёта — id счёта; у ручной — null */
  purchase_invoice_id?: string | null;
};

export type InvoiceAmounts = { gross: number | null; net: number | null; number: string | null; issueDate: string | null };

/** Ручная запись и счёт — один расход: та же валюта и сумма брутто, даты рядом. */
export const DUP_DAYS = 10;

const day = (d: string) => Math.round(Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / 86_400_000);
const near = (a: number | null, b: number | null) => a != null && b != null && Math.abs(a - b) < 0.01;
const compact = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[\s/\\-]+/g, '');

export type DupPair = { manualId: string; invoiceCostId: string; byNumber: boolean };

/**
 * Пары «ручная запись → запись из счёта». Номер счёта в тексте ручной записи — пара
 * при совпадении суммы в любом месяце; иначе сумма + валюта + дата в пределах DUP_DAYS
 * (без даты — тот же месяц). Каждая ручная запись — не больше одной пары.
 */
export function findManualDuplicates(
  costs: CostForDup[],
  invoices: Map<string, InvoiceAmounts>,
): DupPair[] {
  const fromInvoice = costs.filter((c) => c.purchase_invoice_id);
  const manual = costs.filter((c) => !c.purchase_invoice_id);
  const used = new Set<string>();
  const pairs: DupPair[] = [];
  for (const m of manual) {
    let best: DupPair | null = null;
    for (const c of fromInvoice) {
      if (used.has(c.id)) continue;
      const inv = invoices.get(c.purchase_invoice_id!);
      if (!inv) continue;
      if ((m.currency || 'EUR').toUpperCase() !== (c.currency || 'EUR').toUpperCase()) continue;
      // Только брутто: расходы ведутся с НДС; совпадение с нетто давало ложные пары (300 ↔ Logisat 369/300).
      if (!near(m.original_amount, inv.gross ?? inv.net)) continue;
      const num = compact(inv.number);
      const byNumber = num.length >= 4 && compact(m.category).includes(num);
      const mDate = m.expense_date ?? null;
      const cDate = inv.issueDate ?? c.expense_date;
      const close = mDate && cDate ? Math.abs(day(mDate) - day(cDate)) <= DUP_DAYS : m.month_key != null && m.month_key === c.month_key;
      if (!byNumber && !close) continue;
      if (!best || (byNumber && !best.byNumber)) best = { manualId: m.id, invoiceCostId: c.id, byNumber };
    }
    if (best) {
      used.add(best.invoiceCostId);
      pairs.push(best);
    }
  }
  return pairs;
}

export type BankCostForDup = CostForDup & { bank_transaction_id?: string | null; cost_class?: string | null };
export type BankDupPair = { bankCostId: string; invoiceCostId: string; txId: string; invoiceId: string };

/**
 * Строка из выписки, повторяющая счёт подрядчика: чек оплатил сотрудник, а фирма вернула
 * ему деньги переводом («ZWROT KOSZTÓW ZA DRUKARKĘ» ↔ счёт Everprint). Та же валюта и
 * брутто, даты в пределах DUP_DAYS. Наличные и дивиденды — не расходы, не сравниваем.
 */
export function findBankInvoiceDuplicates(costs: BankCostForDup[], invoices: Map<string, InvoiceAmounts>): BankDupPair[] {
  const bank = costs.filter((c) => c.bank_transaction_id && !c.purchase_invoice_id && (c.cost_class ?? 'operating') === 'operating');
  const fromInvoice = costs.filter((c) => c.purchase_invoice_id);
  const used = new Set<string>();
  const pairs: BankDupPair[] = [];
  for (const b of bank) {
    const bDate = b.expense_date;
    if (!bDate) continue;
    let best: { c: BankCostForDup; gap: number } | null = null;
    for (const c of fromInvoice) {
      if (used.has(c.id)) continue;
      const inv = invoices.get(c.purchase_invoice_id!);
      if (!inv) continue;
      if ((b.currency || 'EUR').toUpperCase() !== (c.currency || 'EUR').toUpperCase()) continue;
      if (!near(b.original_amount, inv.gross ?? inv.net)) continue;
      const cDate = inv.issueDate ?? c.expense_date;
      if (!cDate) continue;
      const gap = Math.abs(day(bDate) - day(cDate));
      if (gap > DUP_DAYS) continue;
      if (!best || gap < best.gap) best = { c, gap };
    }
    if (best) {
      used.add(best.c.id);
      pairs.push({ bankCostId: b.id, invoiceCostId: best.c.id, txId: b.bank_transaction_id!, invoiceId: best.c.purchase_invoice_id! });
    }
  }
  return pairs;
}

/** integration_state: ручные общие расходы, которые офис признал «не дублем». */
export const FC_NOT_DOUBLE_KEY = 'fixedCosts.notDouble';
