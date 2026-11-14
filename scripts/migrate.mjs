#!/usr/bin/env node
/**
 * Раскатка миграций supabase/migrations на базу (или на все базы клиентов).
 * Журнал — public.schema_migrations: какая миграция когда применена.
 *
 *   Одна база (строка подключения — Supabase → Connect → Session pooler):
 *     DATABASE_URL='postgresql://…' node scripts/migrate.mjs            # применить недостающие
 *     DATABASE_URL='postgresql://…' node scripts/migrate.mjs --dry-run  # только показать
 *
 *   Существующая база, где миграции применялись руками (один раз):
 *     DATABASE_URL='…' node scripts/migrate.mjs --adopt-through 20261114_022_company_settings
 *
 *   Все клиенты (файл НЕ коммитить — в нём пароли):
 *     node scripts/migrate.mjs --all scripts/tenants.json [--dry-run]
 *     tenants.json: [{ "name": "raibuilding", "url": "postgresql://…" }, …]
 *
 * Порядок релиза: код → деплой → эта команда (миграции, которые убирают то,
 * чем пользуется старый код, — только после деплоя; см. docs/HANDOVER.md).
 *
 * Каждая миграция идемпотентна (CI применяет их дважды), поэтому сбой между
 * выполнением файла и записью в журнал не страшен: повторный запуск
 * применит файл ещё раз без вреда.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { versionOf, checksum, planMigrations } from './migrate-plan.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');

const LEDGER_DDL = `
create table if not exists public.schema_migrations (
  version text primary key,
  checksum text not null,
  applied_at timestamptz not null default now(),
  adopted boolean not null default false
);
alter table public.schema_migrations enable row level security;
revoke all on table public.schema_migrations from public, anon, authenticated;
`;

function parseArgs(argv) {
  const opts = { dryRun: false, adoptThrough: null, all: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--adopt-through') opts.adoptThrough = argv[++i];
    else if (a === '--all') opts.all = argv[++i];
    else if (a === '-h' || a === '--help') opts.help = true;
    else throw new Error(`Неизвестный аргумент: ${a}`);
  }
  return opts;
}

function loadFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => {
      const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
      return { file: f, version: versionOf(f), checksum: checksum(sql), sql };
    });
}

function sslFor(url) {
  const host = new URL(url).hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('/')) return false;
  // Supabase подписывает сертификаты своим CA, которого нет в Node.
  // Для проверки сертификата: PGSSLROOTCERT=путь к CA (Supabase → Database → SSL).
  if (process.env.PGSSLROOTCERT) return { ca: readFileSync(process.env.PGSSLROOTCERT, 'utf8') };
  return { rejectUnauthorized: false };
}

async function migrateOne(name, url, opts, files) {
  const client = new pg.Client({ connectionString: url, ssl: sslFor(url) });
  await client.connect();
  try {
    await client.query('set client_min_messages = warning');
    if (!opts.dryRun) await client.query(LEDGER_DDL);

    const ledgerExists = (await client.query(`select to_regclass('public.schema_migrations') is not null as ok`)).rows[0].ok;
    const applied = new Map(
      ledgerExists
        ? (await client.query('select version, checksum from public.schema_migrations')).rows.map((r) => [r.version, r.checksum])
        : []
    );
    const hasAppTables = (await client.query(`select to_regclass('public.trips') is not null as ok`)).rows[0].ok;

    const plan = planMigrations(files, applied, { hasAppTables, adoptThrough: opts.adoptThrough });
    if (plan.error) throw new Error(plan.error);

    for (const v of plan.changed ?? []) console.warn(`  ⚠ ${name}: ${v} изменён после применения (проверьте, что изменение не нужно накатить новой миграцией)`);
    for (const v of plan.unknown ?? []) console.warn(`  ⚠ ${name}: в журнале ${v}, а файла нет`);
    for (const v of plan.outOfOrder ?? []) console.warn(`  ⚠ ${name}: ${v} старше уже применённых — будет применена не по порядку`);

    if (plan.adopt.length) {
      console.log(`  ${name}: отметить как применённые (без выполнения): ${plan.adopt.length}, по ${opts.adoptThrough}`);
      if (!opts.dryRun) {
        for (const f of plan.adopt) {
          await client.query(
            'insert into public.schema_migrations (version, checksum, adopted) values ($1, $2, true) on conflict (version) do nothing',
            [f.version, f.checksum]
          );
        }
      }
      return { name, adopted: plan.adopt.length, applied: 0 };
    }

    if (plan.pending.length === 0) {
      console.log(`  ${name}: актуальна (${applied.size} миграций)`);
      return { name, applied: 0 };
    }

    const list = plan.pending.map((f) => f.version);
    const shown = list.length > 6 ? [...list.slice(0, 2), `… ещё ${list.length - 4} …`, ...list.slice(-2)] : list;
    console.log(`  ${name}: к применению ${list.length}: ${shown.join(', ')}`);
    if (opts.dryRun) return { name, applied: 0, pending: plan.pending.length };

    let done = 0;
    for (const f of plan.pending) {
      process.stdout.write(`    → ${f.version} … `);
      try {
        await client.query(f.sql);
      } catch (e) {
        // Файлы в begin/commit: при ошибке их транзакция откатывается.
        await client.query('rollback').catch(() => {});
        console.log('ОШИБКА');
        throw new Error(`${f.version}: ${e.message}`);
      }
      await client.query(
        'insert into public.schema_migrations (version, checksum) values ($1, $2) on conflict (version) do update set checksum = excluded.checksum, applied_at = now(), adopted = false',
        [f.version, f.checksum]
      );
      done++;
      console.log('ок');
    }
    return { name, applied: done };
  } finally {
    await client.end();
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
    return;
  }
  const files = loadFiles();
  const targets = opts.all
    ? JSON.parse(readFileSync(resolve(opts.all), 'utf8'))
    : [{ name: 'база', url: process.env.DATABASE_URL }];
  if (targets.some((t) => !t.url)) throw new Error('Нет строки подключения: DATABASE_URL=… или --all tenants.json');
  if (opts.all && opts.adoptThrough) throw new Error('--adopt-through — только для одной базы');

  console.log(`Миграций в репозитории: ${files.length} (последняя ${files.at(-1).version})${opts.dryRun ? ' — пробный прогон' : ''}`);
  let failed = 0;
  for (const t of targets) {
    try {
      await migrateOne(t.name, t.url, opts, files);
    } catch (e) {
      failed++;
      console.error(`  ✖ ${t.name}: ${e.message}`);
      if (!opts.all) break;
    }
  }
  if (failed) {
    console.error(`Ошибок: ${failed} из ${targets.length}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`Ошибка: ${e.message}`);
  process.exit(1);
});
