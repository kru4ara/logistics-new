import { describe, it, expect } from 'vitest';
// @ts-expect-error — .mjs без типов
import { planMigrations, versionOf, checksum } from '../../scripts/migrate-plan.mjs';

const f = (version: string, sum = `sum-${version}`) => ({ version, checksum: sum });
const files = [f('00000000_000_baseline'), f('20261114_020_a'), f('20261114_021_b'), f('20261114_022_c')];
const applied = (...vs: string[]) => new Map(vs.map((v) => [v, `sum-${v}`]));

describe('planMigrations', () => {
  it('новая пустая база — все миграции по порядку', () => {
    const p = planMigrations([...files].reverse(), new Map(), { hasAppTables: false });
    expect(p.pending.map((x: { version: string }) => x.version)).toEqual(files.map((x) => x.version));
  });

  it('база с таблицами, но без журнала (прод) — отказ с подсказкой --adopt-through', () => {
    const p = planMigrations(files, new Map(), { hasAppTables: true });
    expect(p.error).toMatch(/--adopt-through/);
  });

  it('--adopt-through отмечает по указанную версию включительно, ничего не выполняя', () => {
    const p = planMigrations(files, new Map(), { hasAppTables: true, adoptThrough: '20261114_021_b' });
    expect(p.adopt.map((x: { version: string }) => x.version)).toEqual(['00000000_000_baseline', '20261114_020_a', '20261114_021_b']);
    expect(p.pending).toEqual([]);
  });

  it('--adopt-through с несуществующей версией — ошибка, а не «отметить всё»', () => {
    expect(planMigrations(files, new Map(), { hasAppTables: true, adoptThrough: '20261114_099_x' }).error).toMatch(/Нет миграции/);
  });

  it('после adopt — только новые', () => {
    const p = planMigrations(files, applied('00000000_000_baseline', '20261114_020_a', '20261114_021_b'), { hasAppTables: true });
    expect(p.pending.map((x: { version: string }) => x.version)).toEqual(['20261114_022_c']);
  });

  it('всё применено — пусто', () => {
    const p = planMigrations(files, applied(...files.map((x) => x.version)), { hasAppTables: true });
    expect(p.pending).toEqual([]);
  });

  it('предупреждения: файл изменён после применения, файла нет, миграция «в середину»', () => {
    const led = applied('00000000_000_baseline', '20261114_021_b', '20261114_009_gone');
    led.set('00000000_000_baseline', 'другая-сумма');
    const p = planMigrations(files, led, { hasAppTables: true });
    expect(p.changed).toEqual(['00000000_000_baseline']);
    expect(p.unknown).toEqual(['20261114_009_gone']);
    expect(p.outOfOrder).toEqual(['20261114_020_a']);
  });
});

describe('versionOf / checksum', () => {
  it('версия — имя файла без .sql', () => {
    expect(versionOf('20261114_022_company_settings.sql')).toBe('20261114_022_company_settings');
  });
  it('контрольная сумма не зависит от CRLF (правка файла в Windows)', () => {
    expect(checksum('a\r\nb')).toBe(checksum('a\nb'));
    expect(checksum('a')).not.toBe(checksum('b'));
  });
});
