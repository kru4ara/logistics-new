/**
 * Цепочка рейсов одной нашей машины (миграция 046): старт = день после финиша предыдущего.
 * База держит правило для новых изменений; здесь — поиск старых нарушений для списка
 * «Дыры между рейсами». Чистые правила, без Supabase; порядок — как в SQL.
 */

export type ChainTrip = {
  id: string;
  truck_id: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  profit_mode: string | null;
  created_at?: string | null;
  /** «оставить как есть» (миграция 047): старт не по правилу, в список не попадает */
  chain_exempt?: boolean | null;
};

export type ChainIssue = {
  truckId: string;
  prevId: string;
  nextId: string;
  prevEnd: string;
  expectedStart: string;
  actualStart: string | null;
  /** дней между финишем и стартом сверх правила: >0 — дыра, <0 — пересечение */
  days: number;
  kind: 'gap' | 'overlap' | 'noStart';
};

const day = (s: string) => Date.parse(`${s.slice(0, 10)}T00:00:00Z`) / 86400000;
const iso = (d: number) => new Date(d * 86400000).toISOString().slice(0, 10);

export const isOwnChainTrip = (t: ChainTrip) =>
  Boolean(t.truck_id) && t.profit_mode !== 'forwarding' && t.status !== 'cancelled';

/** Нарушения цепочки по машинам: дыры, пересечения, старт не стоит при известном финише. */
export function findChainIssues(trips: ChainTrip[]): ChainIssue[] {
  const byTruck = new Map<string, ChainTrip[]>();
  for (const t of trips) if (isOwnChainTrip(t)) byTruck.set(t.truck_id!, [...(byTruck.get(t.truck_id!) ?? []), t]);
  const out: ChainIssue[] = [];
  for (const [truckId, list] of byTruck) {
    const sorted = [...list].sort((a, b) => {
      const ea = a.end_date ? day(a.end_date) : Infinity;
      const eb = b.end_date ? day(b.end_date) : Infinity;
      if (ea !== eb) return ea - eb;
      const sa = a.start_date ? day(a.start_date) : Infinity;
      const sb = b.start_date ? day(b.start_date) : Infinity;
      if (sa !== sb) return sa - sb;
      return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
    });
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const next = sorted[i];
      if (!prev.end_date || next.chain_exempt) continue;
      let expected = day(prev.end_date) + 1;
      if (next.end_date && expected > day(next.end_date)) expected = day(next.end_date);
      if (!next.start_date) {
        out.push({ truckId, prevId: prev.id, nextId: next.id, prevEnd: prev.end_date.slice(0, 10), expectedStart: iso(expected), actualStart: null, days: 0, kind: 'noStart' });
        continue;
      }
      const diff = day(next.start_date) - expected;
      if (diff === 0) continue;
      out.push({
        truckId,
        prevId: prev.id,
        nextId: next.id,
        prevEnd: prev.end_date.slice(0, 10),
        expectedStart: iso(expected),
        actualStart: next.start_date.slice(0, 10),
        days: diff,
        kind: diff > 0 ? 'gap' : 'overlap',
      });
    }
  }
  return out;
}
