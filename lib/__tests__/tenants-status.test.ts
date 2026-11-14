import { describe, it, expect } from 'vitest';
// @ts-expect-error — .mjs без типов
import { assessTenant, ago, formatTable } from '../../scripts/tenants-status-rules.mjs';

const now = new Date('2026-11-14T12:00:00Z');
const h = (n: number) => new Date(now.getTime() - n * 3_600_000);

describe('сводка по клиентам', () => {
  it('всё в порядке', () => {
    expect(assessTenant({ pending: 0, changed: 0, lastBackupAt: h(5), now })).toEqual({ level: 'ok', notes: [] });
  });
  it('старый или отсутствующий бэкап — тревога', () => {
    expect(assessTenant({ pending: 0, changed: 0, lastBackupAt: h(50), now })).toEqual({ level: 'fail', notes: ['бэкап 2 дн. назад'] });
    expect(assessTenant({ pending: 0, changed: 0, lastBackupAt: null, now }).level).toBe('fail');
  });
  it('неприменённые миграции — предупреждение, недоступная база — тревога', () => {
    expect(assessTenant({ pending: 2, changed: 0, lastBackupAt: h(1), now })).toEqual({ level: 'warn', notes: ['не применено миграций: 2'] });
    expect(assessTenant({ error: 'timeout' }).level).toBe('fail');
  });
  it('давность и таблица', () => {
    expect(ago(h(0.25), now)).toBe('15 мин');
    expect(ago(h(30), now)).toBe('30 ч');
    expect(ago(h(24 * 5), now)).toBe('5 дн');
    expect(ago(null, now)).toBe('—');
    const t = formatTable([{ name: 'acme', level: 'ok', version: '20261114_024', backup: '5 ч', trips: 10, drivers: 3, users: 4, lastLogin: '1 ч', notes: [] }]);
    expect(t.split('\n')[1]).toContain('acme');
  });
});
