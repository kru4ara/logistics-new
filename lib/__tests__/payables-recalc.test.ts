import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// Мини-«база» в памяти с тем подмножеством query builder, что использует recalcSegmentCost и toEur.
type Row = Record<string, any>;
function fakeDb(tables: Record<string, Row[]>) {
  let seq = 0;
  const from = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    let op: 'select' | 'update' | 'delete' | 'insert' = 'select';
    let patch: Row = {};
    let orderBy: { col: string; asc: boolean } | null = null;
    let lim: number | null = null;
    const rows = () => (tables[table] ??= []);
    const run = () => {
      let out = rows().filter((r) => filters.every((f) => f(r)));
      if (op === 'update') { out.forEach((r) => Object.assign(r, patch)); return { data: null, error: null }; }
      if (op === 'delete') { tables[table] = rows().filter((r) => !out.includes(r)); return { data: null, error: null }; }
      if (orderBy) { const { col, asc } = orderBy; out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : -1) * (asc ? 1 : -1)); }
      if (lim != null) out = out.slice(0, lim);
      return { data: out, error: null };
    };
    const q: any = {
      select: () => q,
      eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return q; },
      in: (c: string, v: unknown[]) => { filters.push((r) => v.includes(r[c])); return q; },
      lte: (c: string, v: string) => { filters.push((r) => r[c] <= v); return q; },
      order: (col: string, o?: { ascending?: boolean }) => { orderBy = { col, asc: o?.ascending !== false }; return q; },
      limit: (n: number) => { lim = n; return q; },
      update: (p: Row) => { op = 'update'; patch = p; return q; },
      delete: () => { op = 'delete'; return q; },
      insert: (r: Row) => { rows().push({ id: `new-${++seq}`, ...r }); return Promise.resolve({ data: null, error: null }); },
      maybeSingle: () => { const r = run(); return Promise.resolve({ data: (r.data as Row[])?.[0] ?? null, error: null }); },
      then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
    };
    return q;
  };
  return { from } as any;
}

const segment = { id: 's1', trip_id: 't1', executor_type: 'contractor', price: 2900, currency: 'EUR', date_from: '2026-11-10', from_city: 'Trud', to_city: 'Brest', contractors: { name: 'Trans-Kowalski' } };
const planExpense = () => ({ id: 'e1', trip_id: 't1', segment_id: 's1', category: 'contractor', amount_eur: 2900, original_amount: 2900, currency: 'EUR', description: 'Подрядчик: Trans-Kowalski · Trud → Brest' });
const fuel = { id: 'e2', trip_id: 't1', segment_id: null, category: 'fuel', amount_eur: 500 };
const totalEur = (db: any, tables: Record<string, Row[]>) => tables.trip_expenses.filter((e) => e.trip_id === 't1').reduce((s, e) => s + e.amount_eur, 0);

describe('пересчёт расхода «Подрядчик» участка', () => {
  it('счета заменяют план в той же строке расхода — без задвоения; отвязка возвращает план', async () => {
    const { recalcSegmentCost } = await import('../payables/cost');
    const tables: Record<string, Row[]> = {
      trip_segments: [segment],
      trip_expenses: [planExpense(), fuel],
      purchase_invoices: [],
      rates: [{ rate_date: '2026-11-01', pln_to_eur: 0.235 }],
    };
    const db = fakeDb(tables);

    await recalcSegmentCost(db, 's1');
    expect(totalEur(db, tables)).toBe(3400); // план 2900 + топливо 500

    tables.purchase_invoices.push(
      { segment_id: 's1', invoice_number: 'FV 15/11/2026', net_amount: 2900, gross_amount: 2900, currency: 'EUR', issue_date: '2026-11-14' },
      { segment_id: 's1', invoice_number: 'FV 16/11/2026', net_amount: 1000, gross_amount: 1230, currency: 'PLN', issue_date: '2026-11-15' },
    );
    await recalcSegmentCost(db, 's1');
    const contractorRows = tables.trip_expenses.filter((e) => e.category === 'contractor');
    expect(contractorRows).toHaveLength(1);
    expect(contractorRows[0]).toMatchObject({ id: 'e1', amount_eur: 3135, currency: 'EUR' }); // 2900 + 1000 × 0,235
    expect(contractorRows[0].description).toContain('по счетам: FV 15/11/2026, FV 16/11/2026');
    expect(totalEur(db, tables)).toBe(3635);

    tables.purchase_invoices = [];
    await recalcSegmentCost(db, 's1');
    expect(tables.trip_expenses.find((e) => e.id === 'e1')).toMatchObject({ amount_eur: 2900, original_amount: 2900, description: 'Подрядчик: Trans-Kowalski · Trud → Brest' });
  });

  it('рейс 18Е: нулевая korekta не обнуляет расход подрядчика', async () => {
    const { recalcSegmentCost } = await import('../payables/cost');
    const tables: Record<string, Row[]> = {
      trip_segments: [{ ...segment, price: 2400 }],
      trip_expenses: [{ ...planExpense(), amount_eur: 0, original_amount: 0 }],
      purchase_invoices: [{ segment_id: 's1', invoice_number: 'KS 032/09/2026', invoice_type: 'KOR', net_amount: 0, gross_amount: 0, currency: 'EUR', issue_date: '2026-10-02' }],
      rates: [],
    };
    await recalcSegmentCost(fakeDb(tables), 's1');
    expect(tables.trip_expenses[0]).toMatchObject({ amount_eur: 2400, original_amount: 2400, description: 'Подрядчик: Trans-Kowalski · Trud → Brest' });
  });

  it('нет строки расхода — создаёт одну; лишние дубли удаляет', async () => {
    const { recalcSegmentCost } = await import('../payables/cost');
    const tables: Record<string, Row[]> = { trip_segments: [segment], trip_expenses: [], purchase_invoices: [], rates: [] };
    const db = fakeDb(tables);
    await recalcSegmentCost(db, 's1');
    expect(tables.trip_expenses).toEqual([expect.objectContaining({ segment_id: 's1', category: 'contractor', amount_eur: 2900 })]);
    tables.trip_expenses.push({ ...planExpense(), id: 'dup' });
    await recalcSegmentCost(db, 's1');
    expect(tables.trip_expenses.filter((e) => e.category === 'contractor')).toHaveLength(1);
  });

  it('участок своими силами — не трогаем', async () => {
    const { recalcSegmentCost } = await import('../payables/cost');
    const tables: Record<string, Row[]> = { trip_segments: [{ ...segment, executor_type: 'us' }], trip_expenses: [fuel], purchase_invoices: [], rates: [] };
    await recalcSegmentCost(fakeDb(tables), 's1');
    expect(tables.trip_expenses).toEqual([fuel]);
  });
});

describe('закрытый месяц', () => {
  it('без подтверждения расход не меняется; с подтверждением (force) — по счетам', async () => {
    const { recalcSegmentCost, previewSegmentCost } = await import('../payables/cost');
    const tables: Record<string, Row[]> = {
      trip_segments: [{ ...segment, trips: { start_date: '2026-09-07', end_date: '2026-09-10' } }],
      trip_expenses: [planExpense()],
      purchase_invoices: [{ segment_id: 's1', invoice_number: 'FV 1', invoice_type: 'VAT', net_amount: 3100, gross_amount: 3100, currency: 'EUR', issue_date: '2026-10-02' }],
      closed_months: [{ month: '2026-09' }],
      rates: [],
    };
    const db = fakeDb(tables);
    expect(await recalcSegmentCost(db, 's1')).toBe('closed');
    expect(tables.trip_expenses[0].amount_eur).toBe(2900);
    expect(await previewSegmentCost(db, 's1')).toEqual({ currentEur: 2900, targetEur: 3100, pending: true });
    expect(await recalcSegmentCost(db, 's1', { force: true })).toBe('updated');
    expect(tables.trip_expenses[0].amount_eur).toBe(3100);
    expect((await previewSegmentCost(db, 's1'))?.pending).toBe(false);
    // месяц открыт — пересчёт как обычно
    tables.closed_months = [];
    tables.purchase_invoices[0].net_amount = 3200;
    expect(await recalcSegmentCost(db, 's1')).toBe('updated');
    expect(tables.trip_expenses[0].amount_eur).toBe(3200);
  });
});
