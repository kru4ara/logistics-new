/**
 * Проверка документов агентства по рейсам: EPI и EX-1 (lib/payables/trip-rules.ts —
 * одна категория на рейс). Чистые правила, без Supabase.
 *
 * По каждому рейсу и категории сравниваем записи «вручную» и «из счёта подрядчика»:
 *  • double     — есть и ручная, и из счёта: возможно, один расход дважды;
 *  • noInvoice  — только ручная, счёта нет: счёт агентства не внесён или привязан не туда;
 *  • multi      — несколько счетов одной категории в рейсе: проверить, не один ли документ;
 *  • ok         — только из счёта (одного), или ручная, оплаченная водителем (счёта не будет).
 */

export const AGENCY_CATEGORIES = ['epi', 'ex1'] as const;
export type AgencyCategory = (typeof AGENCY_CATEGORIES)[number];

export type AgencyExpense = {
  id: string;
  trip_id: string;
  category: string | null;
  description: string | null;
  original_amount: number | null;
  currency: string | null;
  amount_eur: number | null;
  purchase_invoice_id: string | null;
  paid_by_driver: boolean | null;
};

export type AgencyIssue = 'double' | 'noInvoice' | 'multi' | 'ok';

export type AgencyRow = {
  tripId: string;
  category: AgencyCategory;
  manual: AgencyExpense[];
  fromInvoice: AgencyExpense[];
  manualEur: number;
  invoiceEur: number;
  issue: AgencyIssue;
};

const isAgency = (c: string | null): c is AgencyCategory => (AGENCY_CATEGORIES as readonly string[]).includes(c ?? '');
const eur = (rows: AgencyExpense[]) => Math.round(rows.reduce((s, r) => s + Number(r.amount_eur ?? 0), 0) * 100) / 100;

/** checked — ручные записи, которые офис уже признал «не дублем» (payables.notDouble). */
export function inspectAgencyExpenses(expenses: AgencyExpense[], checked: Set<string> = new Set()): AgencyRow[] {
  const groups = new Map<string, AgencyRow>();
  for (const e of expenses) {
    if (!isAgency(e.category)) continue;
    const key = `${e.trip_id}|${e.category}`;
    let g = groups.get(key);
    if (!g) {
      g = { tripId: e.trip_id, category: e.category, manual: [], fromInvoice: [], manualEur: 0, invoiceEur: 0, issue: 'ok' };
      groups.set(key, g);
    }
    (e.purchase_invoice_id ? g.fromInvoice : g.manual).push(e);
  }
  const rows = [...groups.values()];
  for (const g of rows) {
    g.manualEur = eur(g.manual);
    g.invoiceEur = eur(g.fromInvoice);
    const invoices = new Set(g.fromInvoice.map((e) => e.purchase_invoice_id));
    // Оплатил водитель на границе — счёта агентства не будет, это не «без счёта».
    const manualCompany = g.manual.filter((e) => !e.paid_by_driver && !checked.has(e.id));
    const unchecked = g.manual.filter((e) => !checked.has(e.id));
    if (unchecked.length && g.fromInvoice.length) g.issue = 'double';
    else if (manualCompany.length) g.issue = 'noInvoice';
    else if (invoices.size > 1) g.issue = 'multi';
    else g.issue = 'ok';
  }
  const order: Record<AgencyIssue, number> = { double: 0, noInvoice: 1, multi: 2, ok: 3 };
  return rows.sort((a, b) => order[a.issue] - order[b.issue]);
}

/** Сводка для заголовка: сколько рейсов с каждой проблемой. */
export function agencySummary(rows: AgencyRow[]): Record<AgencyIssue, number> {
  const s: Record<AgencyIssue, number> = { double: 0, noInvoice: 0, multi: 0, ok: 0 };
  for (const r of rows) s[r.issue]++;
  return s;
}
