// Кредиторка: сводка по счетам подрядчиков — чистые правила (тесты).

export type PayableRow = {
  id: string;
  ksef_number: string | null;
  source?: 'ksef' | 'manual';
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
  /** привязан к рейсу целиком как расход (миграция 037) */
  trip_id?: string | null;
  /** категория накладных у «не относится к рейсам» (миграция 038) */
  overhead_category?: string | null;
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
  // Без привязки — и оплаченные тоже: иначе счёт, отмеченный оплаченным раньше привязки,
  // навсегда пропадает из «требуют привязки», и расход не доходит до рейса.
  const unmatched = rows.filter((r) => r.match_status === 'none' && !r.segment_id && !r.trip_id);
  const toPay = unpaid
    .filter((r) => !unmatched.includes(r))
    .sort((a, b) => (a.payment_due ?? '9999').localeCompare(b.payment_due ?? '9999'));
  const overdue = unpaid.filter((r) => r.payment_due && r.payment_due < today);
  const since = new Date(Date.parse(today) - 60 * 86_400_000).toISOString().slice(0, 10);
  const paidRecent = rows.filter((r) => r.paid_at && r.paid_at >= since && !unmatched.includes(r));
  return {
    unmatched,
    toPay,
    paidRecent,
    unpaidByCurrency: byCurrency(unpaid),
    overdueByCurrency: byCurrency(overdue),
  };
}
