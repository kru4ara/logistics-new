// Кредиторка: сводка по счетам подрядчиков — чистые правила (тесты).

export type PayableRow = {
  id: string;
  ksef_number: string;
  invoice_number: string | null;
  issue_date: string | null;
  seller_nip: string | null;
  seller_name: string | null;
  net_amount: number | null;
  gross_amount: number | null;
  currency: string | null;
  payment_due: string | null;
  description: string | null;
  segment_id: string | null;
  match_status: 'none' | 'auto' | 'manual' | 'ignored';
  paid_at: string | null;
};

type ByCurrency = { currency: string; amount: number }[];

function byCurrency(rows: PayableRow[]): ByCurrency {
  const m = new Map<string, number>();
  for (const r of rows) {
    const c = r.currency || 'PLN';
    m.set(c, (m.get(c) ?? 0) + (r.gross_amount ?? 0));
  }
  return [...m].map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
}

/** Сводка: к оплате, просрочено (по валютам), без привязки, оплаченные за 60 дней. */
export function summarizePayables(rows: PayableRow[], today: string) {
  const unpaid = rows.filter((r) => !r.paid_at);
  const unmatched = unpaid.filter((r) => r.match_status === 'none' && !r.segment_id);
  const toPay = unpaid
    .filter((r) => !unmatched.includes(r))
    .sort((a, b) => (a.payment_due ?? '9999').localeCompare(b.payment_due ?? '9999'));
  const overdue = unpaid.filter((r) => r.payment_due && r.payment_due < today);
  const since = new Date(Date.parse(today) - 60 * 86_400_000).toISOString().slice(0, 10);
  const paidRecent = rows.filter((r) => r.paid_at && r.paid_at >= since);
  return {
    unmatched,
    toPay,
    paidRecent,
    unpaidByCurrency: byCurrency(unpaid),
    overdueByCurrency: byCurrency(overdue),
  };
}
