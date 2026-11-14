// Чистая логика раскатки миграций — без базы, для юнит-тестов.
// Используется scripts/migrate.mjs.
import { createHash } from 'node:crypto';

/** Версия = имя файла без .sql: «20261114_022_company_settings». */
export function versionOf(filename) {
  return filename.replace(/\.sql$/, '');
}

export function checksum(sql) {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
}

/**
 * Что делать с базой.
 * @param files   [{ version, checksum }] — файлы из supabase/migrations, по порядку
 * @param applied Map<version, checksum> — журнал schema_migrations
 * @param opts    { hasAppTables: есть ли в базе таблицы приложения,
 *                  adoptThrough?: версия — отметить по неё включительно как применённые }
 */
export function planMigrations(files, applied, opts) {
  const sorted = [...files].sort((a, b) => a.version.localeCompare(b.version));
  const known = new Set(sorted.map((f) => f.version));

  if (opts.adoptThrough) {
    if (!known.has(opts.adoptThrough)) {
      return { error: `Нет миграции ${opts.adoptThrough}. Есть: ${sorted.at(-1)?.version ?? '—'} и раньше` };
    }
    const adopt = sorted.filter((f) => f.version <= opts.adoptThrough && !applied.has(f.version));
    return { adopt, pending: [], changed: [], unknown: [] };
  }

  // База с данными, но без журнала: миграции применялись руками.
  // Применять всё с нуля нельзя — нужно один раз отметить, что уже есть.
  if (applied.size === 0 && opts.hasAppTables) {
    return {
      error:
        'В базе уже есть таблицы приложения, а журнал миграций пуст: миграции применялись вручную. ' +
        'Один раз отметьте применённые: --adopt-through <последняя применённая версия>',
    };
  }

  const pending = sorted.filter((f) => !applied.has(f.version));
  const changed = sorted
    .filter((f) => applied.has(f.version) && applied.get(f.version) !== f.checksum)
    .map((f) => f.version);
  const unknown = [...applied.keys()].filter((v) => !known.has(v)).sort();

  // Применённая миграция новее ожидающей — файл добавили «в середину».
  const lastApplied = [...applied.keys()].filter((v) => known.has(v)).sort().at(-1);
  const outOfOrder = lastApplied ? pending.filter((f) => f.version < lastApplied).map((f) => f.version) : [];

  return { adopt: [], pending, changed, unknown, outOfOrder };
}
