#!/usr/bin/env node
/**
 * Сводка по всем клиентам: версия схемы, последний бэкап, объём данных, последний вход.
 * Только чтение — в базах ничего не меняет.
 *
 *   node scripts/tenants-status.mjs scripts/tenants.json
 *   DATABASE_URL='postgresql://…' node scripts/tenants-status.mjs      # одна база
 *
 * tenants.json — тот же файл, что для migrate.mjs (НЕ коммитить, в нём пароли).
 * Код выхода 1, если хоть у одного клиента ❌ — можно запускать по расписанию.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { versionOf, checksum } from './migrate-plan.mjs';
import { assessTenant, ago, formatTable } from './tenants-status-rules.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'supabase', 'migrations');
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()
  .map((f) => ({ version: versionOf(f), checksum: checksum(readFileSync(join(DIR, f), 'utf8')) }));
const latest = files.at(-1).version;

function sslFor(url) {
  const host = new URL(url).hostname;
  if (host === 'localhost' || host === '127.0.0.1') return false;
  if (process.env.PGSSLROOTCERT) return { ca: readFileSync(process.env.PGSSLROOTCERT, 'utf8') };
  return { rejectUnauthorized: false };
}

async function scalar(client, sql) {
  try {
    const { rows } = await client.query(sql);
    return rows[0] ? Object.values(rows[0])[0] : null;
  } catch {
    return null; // таблицы нет в старой базе — показываем «—»
  }
}

async function inspect(name, url, now) {
  const client = new pg.Client({ connectionString: url, ssl: sslFor(url), connectionTimeoutMillis: 10_000 });
  try {
    await client.connect();
    await client.query('begin read only');
    const applied = new Map();
    try {
      const { rows } = await client.query('select version, checksum from public.schema_migrations');
      for (const r of rows) applied.set(r.version, r.checksum);
    } catch { /* журнала нет */ }
    const pending = files.filter((f) => !applied.has(f.version)).length;
    const changed = files.filter((f) => applied.has(f.version) && applied.get(f.version) !== f.checksum).length;
    const version = [...applied.keys()].sort().at(-1) ?? '—';

    const lastBackupAt = await scalar(client, `select max(created_at) from public.audit_log where user_name = 'Cron' and summary like 'Бэкап выполнен%'`);
    const trips = await scalar(client, 'select count(*)::int from public.trips');
    const drivers = await scalar(client, 'select count(*)::int from public.drivers');
    const users = await scalar(client, 'select count(*)::int from public.profiles');
    const lastLogin = await scalar(client, 'select max(last_sign_in_at) from auth.users');
    await client.query('rollback');

    const { level, notes } = assessTenant({ pending, changed, lastBackupAt, now });
    return {
      name, level, notes, trips, drivers, users,
      version: version === latest ? version.slice(0, 12) : `${version.slice(0, 12)} (+${pending})`,
      backup: ago(lastBackupAt, now),
      lastLogin: ago(lastLogin, now),
    };
  } catch (e) {
    const { level, notes } = assessTenant({ error: e.message });
    return { name, level, notes, version: '—', backup: '—', lastLogin: '—' };
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  const arg = process.argv[2];
  const targets = arg ? JSON.parse(readFileSync(resolve(arg), 'utf8')) : [{ name: 'база', url: process.env.DATABASE_URL }];
  if (targets.some((t) => !t.url)) throw new Error('Нет строки подключения: tenants.json или DATABASE_URL=…');
  const now = new Date();
  const rows = await Promise.all(targets.map((t) => inspect(t.name, t.url, now)));
  console.log(`Последняя миграция в репозитории: ${latest}\n`);
  console.log(formatTable(rows));
  const bad = rows.filter((r) => r.level === 'fail').length;
  console.log(`\nВсего: ${rows.length} · проблем: ${bad} · предупреждений: ${rows.filter((r) => r.level === 'warn').length}`);
  if (bad) process.exit(1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
