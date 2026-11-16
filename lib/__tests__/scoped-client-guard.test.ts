import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Сторож RLS для менеджера (этап 1): страницы, которые открывает менеджер,
 * читают заказы и их содержимое через scopedClient() (lib/supabase/scoped.ts) —
 * тогда чужие заказы не отдаёт сама база, даже если фильтр в коде забыт.
 * admin-клиентом (`supabase`) — только справочники.
 */
const SCOPED_PAGES = [
  'app/page.tsx',
  'app/trips/page.tsx',
  'app/trips/[id]/page.tsx',
  'app/trips/[id]/edit/page.tsx',
  'app/statistics/page.tsx',
  'app/drivers/kpi/page.tsx',
  'app/map/page.tsx',
  'app/today/page.tsx',
  'app/clients/page.tsx',
  'app/reports/page.tsx',
  'app/routes/page.tsx',
  'app/search/actions.ts',
  'app/api/trips/[id]/segment/[segId]/docx/route.ts',
  'app/api/trips/[id]/segment/[segId]/driver-docx/route.ts',
];

const TRIP_TABLES = /\bsupabase\s*\.from\('(trips|trip_segments|trip_expenses|trip_cargo|trip_documents|trip_segment_cargo)'\)/g;

describe('страницы менеджера читают заказы через scopedClient', () => {
  it.each(SCOPED_PAGES)('%s', (f) => {
    const src = readFileSync(join(process.cwd(), f), 'utf8');
    const lines = src.split('\n');
    const bad: string[] = [];
    lines.forEach((l, i) => {
      // многострочное `supabase\n  .from('trips')` — склеиваем со следующей строкой
      const two = `${l}\n${lines[i + 1] ?? ''}`;
      if (/^\s*\/\//.test(l)) return;
      for (const m of two.matchAll(TRIP_TABLES)) if (m.index! < l.length) bad.push(`${i + 1}: ${m[0].replace(/\s+/g, '')}`);
    });
    expect(bad, `${f}: заказы через admin-клиент — используйте scoped.from(...)`).toEqual([]);
    expect(src).toContain('scopedClient');
  });
});
