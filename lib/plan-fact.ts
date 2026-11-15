// Отчёт «План → факт» за месяц — чистые правила (тесты).
// Подрядчики: план — цена из заявки (EUR), факт — по счетам (расход участка после пересчёта).
// Клиенты: фрахт заказа против суммы фактуры.

export type RateRow = { rate_date: string; pln_to_eur: number | null; byn_to_eur: number | null };

/** EUR по курсу на дату из уже загруженной таблицы курсов (как lib/fx.ts, без запросов). */
export function eurAt(amount: number, currency: string | null, date: string, rates: RateRow[]): number {
  const cur = (currency || 'EUR').toUpperCase();
  if (cur === 'EUR') return amount;
  const col = cur === 'PLN' ? 'pln_to_eur' : cur === 'BYN' ? 'byn_to_eur' : null;
  if (!col) return amount;
  let rate: number | null = null;
  for (const r of rates) {
    if (r.rate_date <= date && r[col] != null) rate = Number(r[col]); // rates — по возрастанию даты
    if (r.rate_date > date) break;
  }
  return Math.round(amount * (rate && rate > 0 ? rate : cur === 'PLN' ? 0.23 : 0.3) * 100) / 100;
}

/** Месяц «YYYY-MM» → [первый день, первый день следующего). Неверный — текущий месяц. */
export function monthRange(month: string | undefined, today: string): { month: string; from: string; to: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(month ?? '') ?? /^(\d{4})-(\d{2})/.exec(today)!;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const pad = (n: number) => String(n).padStart(2, '0');
  const next = mo === 12 ? `${y + 1}-01` : `${y}-${pad(mo + 1)}`;
  return { month: `${y}-${pad(mo)}`, from: `${y}-${pad(mo)}-01`, to: `${next}-01` };
}

export type SegmentPF = {
  segmentId: string;
  tripId: string;
  tripNumber: string | null;
  position: number;
  contractorId: string | null;
  contractorName: string | null;
  planEur: number | null;
  /** расход участка после пересчёта по счетам; null — счетов нет */
  factEur: number | null;
  invoiceCount: number;
};

export type ClientPF = {
  tripId: string;
  tripNumber: string | null;
  clientName: string | null;
  invoiceNumber: string | null;
  revenueEur: number | null;
  invoiceEur: number | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
/** заметное расхождение: больше 1 € и больше 1 % */
const notable = (diff: number, base: number) => Math.abs(diff) > Math.max(1, Math.abs(base) * 0.01);

export type ContractorRow = {
  contractorId: string | null;
  name: string;
  segments: number;
  invoiced: number;
  planEur: number;
  factEur: number;
  diffEur: number;
  /** участков, где счёт больше заявки */
  over: number;
};

export function buildPlanFact(segments: SegmentPF[], clients: ClientPF[]) {
  const withFact = segments.filter((s) => s.factEur != null && s.planEur != null);
  const segDiffs = withFact
    .map((s) => ({ ...s, diffEur: r2((s.factEur as number) - (s.planEur as number)) }))
    .filter((s) => notable(s.diffEur, s.planEur as number))
    .sort((a, b) => b.diffEur - a.diffEur);
  const missing = segments.filter((s) => s.invoiceCount === 0);

  const byContractor = new Map<string, ContractorRow>();
  for (const s of segments) {
    const key = s.contractorId ?? `name:${s.contractorName ?? '—'}`;
    const row = byContractor.get(key) ?? {
      contractorId: s.contractorId, name: s.contractorName ?? '—', segments: 0, invoiced: 0, planEur: 0, factEur: 0, diffEur: 0, over: 0,
    };
    row.segments++;
    if (s.factEur != null && s.planEur != null) {
      row.invoiced++;
      row.planEur = r2(row.planEur + s.planEur);
      row.factEur = r2(row.factEur + s.factEur);
      const d = s.factEur - s.planEur;
      row.diffEur = r2(row.diffEur + d);
      if (d > 0 && notable(d, s.planEur)) row.over++;
    }
    byContractor.set(key, row);
  }
  const contractors = [...byContractor.values()].sort((a, b) => b.diffEur - a.diffEur || b.segments - a.segments);

  const clientDiffs = clients
    .filter((c) => c.invoiceEur != null && c.revenueEur != null && notable(c.invoiceEur - c.revenueEur, c.revenueEur))
    .map((c) => ({ ...c, diffEur: r2((c.invoiceEur as number) - (c.revenueEur as number)) }))
    .sort((a, b) => Math.abs(b.diffEur) - Math.abs(a.diffEur));

  const contractorDiff = r2(withFact.reduce((s, x) => s + ((x.factEur as number) - (x.planEur as number)), 0));
  const clientDiff = r2(clientDiffs.reduce((s, x) => s + x.diffEur, 0));
  return {
    segDiffs,
    missing,
    contractors,
    clientDiffs,
    totals: {
      segments: segments.length,
      invoiced: withFact.length,
      planEur: r2(withFact.reduce((s, x) => s + (x.planEur as number), 0)),
      factEur: r2(withFact.reduce((s, x) => s + (x.factEur as number), 0)),
      contractorDiff,
      clientDiff,
      /** влияние на маржу: перерасход подрядчиков уменьшает её, фактуры сверх фрахта — увеличивают */
      marginImpact: r2(clientDiff - contractorDiff),
    },
  };
}
