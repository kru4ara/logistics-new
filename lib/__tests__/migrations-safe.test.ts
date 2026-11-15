import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Миграции применяются автоматически ПОСЛЕ деплоя кода (.github/workflows/migrate.yml),
// а старый код работает до деплоя. Значит, миграция не должна ломать старый код:
// удалить / переименовать / сменить тип — только отдельным PR, когда код уже не
// пользуется старым. Такую миграцию помечают строкой `-- contract: <почему безопасно>`.
//
// Проверяем только новые миграции: всё до LAST_MANUAL применялось руками.
const LAST_MANUAL = '20261115_032_client_portal';
const DIR = join(process.cwd(), 'supabase/migrations');

const RISKY: Array<[RegExp, string]> = [
  [/\bdrop\s+table\b/i, 'drop table'],
  [/\bdrop\s+column\b/i, 'drop column'],
  [/\bdrop\s+type\b/i, 'drop type'],
  [/\brename\s+(column\s+)?\S+\s+to\b/i, 'rename'],
  [/\brename\s+to\b/i, 'rename'],
  [/\balter\s+column\s+\S+\s+(set\s+data\s+)?type\b/i, 'alter column … type'],
  [/\balter\s+column\s+\S+\s+set\s+not\s+null\b/i, 'set not null'],
];

function riskyStatements(sql: string): string[] {
  if (/^\s*--\s*contract:/im.test(sql)) return [];
  const code = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  return RISKY.filter(([re]) => re.test(code)).map(([, name]) => name);
}

describe('миграции совместимы со старым кодом', () => {
  it('распознаёт опасное и пометку contract', () => {
    expect(riskyStatements('alter table trips drop column foo;')).toEqual(['drop column']);
    expect(riskyStatements('alter table t rename column a to b;')).toContain('rename');
    expect(riskyStatements('alter table t alter column a type text;')).toEqual(['alter column … type']);
    expect(riskyStatements('-- contract: код перестал читать foo в #120\nalter table trips drop column foo;')).toEqual([]);
    expect(riskyStatements('alter table t add column if not exists a text; drop policy if exists p on t;')).toEqual([]);
    expect(riskyStatements('-- drop table x\nselect 1;')).toEqual([]);
  });

  const files = readdirSync(DIR).filter((f) => f.endsWith('.sql') && f.replace(/\.sql$/, '') > LAST_MANUAL).sort();
  it.each(files.length ? files : ['(нет новых)'])('%s', (f) => {
    if (!f.endsWith('.sql')) return;
    const found = riskyStatements(readFileSync(join(DIR, f), 'utf8'));
    expect(found, `${f}: ${found.join(', ')} — сломает код, который ещё работает до деплоя. Разнесите на два PR или пометьте «-- contract: …»`).toEqual([]);
  });
});
