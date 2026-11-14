#!/usr/bin/env node
/**
 * Развёртывание новой компании: свой проект Supabase (ЕС) + свой проект Vercel из этого репозитория.
 * Ручной порядок тех же шагов — docs/PROVISIONING.md.
 *
 *   SUPABASE_ACCESS_TOKEN=…  SUPABASE_ORG=<slug организации>  VERCEL_TOKEN=…  [VERCEL_TEAM_ID=…] \
 *   [OPS_TELEGRAM_BOT_TOKEN=… OPS_TELEGRAM_CHAT_ID=…] \
 *   node scripts/provision-tenant.mjs --name acme --domain crm.example.com \
 *        --office-email office@acme.pl [--office-name "Jan Kowalski"] [--company "ACME Sp. z o.o."] \
 *        [--region eu-central-1] [--telegram-token …] [--telegram-chat-id …] [--dry-run]
 *
 * Токены: Supabase → Account → Access Tokens; Vercel → Account Settings → Tokens.
 * Репозиторий должен быть подключён к Vercel (GitHub-интеграция) — иначе проект не создастся.
 *
 * Состояние и все секреты пишутся в scripts/tenants/<name>.json (папка в .gitignore, НЕ коммитить).
 * Упал на шаге — запустите ту же команду снова: сделанные шаги пропускаются.
 * --dry-run — показать, что будет сделано, ничего не создавая.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import {
  nextSteps, validateOptions, generateSecrets, buildEnv, poolerUrl, appUrl, mask, VERCEL_REGION,
} from './provision-plan.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = process.env.PROVISION_REPO || 'kru4ara/logistics-new';
// Адреса API переопределяются только для теста скрипта на заглушках (lib/__tests__/provision-e2e).
const SUPABASE_API = process.env.SUPABASE_API_URL || 'https://api.supabase.com';
const VERCEL_API = process.env.VERCEL_API_URL || 'https://api.vercel.com';
const TELEGRAM_API = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';
const projectUrl = (ref) => process.env.SUPABASE_PROJECT_URL || `https://${ref}.supabase.co`;

// ---------- аргументы ----------
function parseArgs(argv) {
  const o = { region: 'eu-west-1', dryRun: false };
  const map = {
    '--name': 'name', '--domain': 'domain', '--office-email': 'officeEmail', '--office-name': 'officeName',
    '--company': 'company', '--region': 'region', '--telegram-token': 'telegramToken', '--telegram-chat-id': 'telegramChatId',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') o.dryRun = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (map[a]) o[map[a]] = argv[++i];
    else throw new Error(`Неизвестный аргумент: ${a}`);
  }
  return o;
}

// ---------- состояние ----------
const STATE_DIR = join(ROOT, 'scripts', 'tenants');
const statePath = (name) => join(STATE_DIR, `${name}.json`);
function loadState(name) {
  return existsSync(statePath(name)) ? JSON.parse(readFileSync(statePath(name), 'utf8')) : { done: [] };
}
function saveState(name, state) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(statePath(name), JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
}

// ---------- HTTP ----------
async function api(base, token, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = typeof data === 'object' && data ? data.message || data.error?.message || JSON.stringify(data) : text;
    throw new Error(`${method} ${path} → ${res.status}: ${String(msg).slice(0, 300)}`);
  }
  return data;
}
const supa = (method, path, body) => api(SUPABASE_API, process.env.SUPABASE_ACCESS_TOKEN, method, path, body);
const teamQs = () => (process.env.VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : '');
const vercel = (method, path, body) => api(VERCEL_API, process.env.VERCEL_TOKEN, method, path + teamQs(), body);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sslFor(url) {
  const host = new URL(url).hostname;
  if (host === 'localhost' || host === '127.0.0.1') return false;
  if (process.env.PGSSLROOTCERT) return { ca: readFileSync(process.env.PGSSLROOTCERT, 'utf8') };
  return { rejectUnauthorized: false }; // как в migrate.mjs: CA Supabase нет в Node
}

// ---------- шаги ----------
const STEP = {
  async 'supabase-project'(o, s) {
    const project = await supa('POST', '/v1/projects', {
      name: `logistics-${o.name}`,
      organization_slug: process.env.SUPABASE_ORG,
      region: o.region,
      db_pass: s.secrets.dbPassword,
    });
    s.supabaseRef = project.id || project.ref;
    s.supabaseUrl = projectUrl(s.supabaseRef);
    console.log(`    проект ${s.supabaseRef} (${o.region})`);
  },

  async 'supabase-ready'(o, s) {
    for (let i = 0; i < 60; i++) {
      const p = await supa('GET', `/v1/projects/${s.supabaseRef}`);
      if (p.status === 'ACTIVE_HEALTHY') return;
      process.stdout.write(`    ${p.status}…\r`);
      await sleep(10_000);
    }
    throw new Error('проект не стал ACTIVE_HEALTHY за 10 минут — проверьте в панели Supabase и запустите снова');
  },

  async 'supabase-keys'(o, s) {
    const keys = await supa('GET', `/v1/projects/${s.supabaseRef}/api-keys?reveal=true`);
    const byName = (n) => keys.find((k) => k.name === n)?.api_key;
    s.anonKey = byName('anon');
    s.serviceKey = byName('service_role');
    if (!s.anonKey || !s.serviceKey) {
      throw new Error('в проекте нет ключей anon / service_role — включите их: Project Settings → API Keys → Legacy API keys, и запустите снова');
    }
  },

  async 'supabase-auth'(o, s) {
    await supa('PATCH', `/v1/projects/${s.supabaseRef}/config/auth`, { disable_signup: true, site_url: appUrl(o) });
  },

  async database(o, s) {
    const cfg = await supa('GET', `/v1/projects/${s.supabaseRef}/config/database/pooler`);
    s.databaseUrl = poolerUrl(cfg, s.secrets.dbPassword);
    if (!s.databaseUrl) throw new Error('не удалось получить строку подключения pooler');
    // migrate.mjs — тот же код, что для всех клиентов; дважды: второй прогон должен сказать «актуальна»
    for (const pass of [1, 2]) {
      const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'migrate.mjs')], {
        env: { ...process.env, DATABASE_URL: s.databaseUrl }, stdio: 'inherit',
      });
      if (r.status !== 0) throw new Error(`migrate.mjs завершился с ошибкой (проход ${pass})`);
    }
  },

  async 'office-user'(o, s) {
    const res = await fetch(`${s.supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: s.serviceKey, Authorization: `Bearer ${s.serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: o.officeEmail, password: s.secrets.officePassword, email_confirm: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`создание пользователя офиса → ${res.status}: ${data.msg || data.message || JSON.stringify(data)}`);
    s.officeUserId = data.id;
    // Триггер on_auth_user_created создал профиль с ролью driver — делаем офисом.
    const client = new pg.Client({ connectionString: s.databaseUrl, ssl: sslFor(s.databaseUrl) });
    await client.connect();
    try {
      const r = await client.query('update public.profiles set role = $1, full_name = $2 where id = $3', [
        'office', o.officeName || o.officeEmail, s.officeUserId,
      ]);
      if (r.rowCount !== 1) throw new Error('профиль офиса не найден — проверьте триггер on_auth_user_created');
    } finally {
      await client.end();
    }
  },

  async company(o, s) {
    // Только название: остальное офис заполнит сам в «Первых шагах» → Настройки компании.
    const client = new pg.Client({ connectionString: s.databaseUrl, ssl: sslFor(s.databaseUrl) });
    await client.connect();
    try {
      await client.query(
        `insert into public.company_settings (id, name, telegram_bot) values (1, $1, null)
         on conflict (id) do nothing`,
        [o.company || o.name],
      );
    } finally {
      await client.end();
    }
  },

  async 'vercel-project'(o, s) {
    const project = await vercel('POST', '/v11/projects', {
      name: `logistics-${o.name}`,
      framework: 'nextjs',
      gitRepository: { type: 'github', repo: REPO },
      serverlessFunctionRegion: VERCEL_REGION[o.region],
      environmentVariables: buildEnv(o, s, process.env),
    });
    s.vercelProjectId = project.id;
    console.log(`    проект Vercel ${project.id}, функции в ${VERCEL_REGION[o.region]}`);
  },

  async 'vercel-domain'(o, s) {
    const domain = `${o.name}.${o.domain}`;
    await vercel('POST', `/v10/projects/${s.vercelProjectId}/domains`, { name: domain });
    console.log(`    домен ${domain} — у регистратора: CNAME ${o.name} → cname.vercel-dns.com`);
  },

  async 'vercel-deploy'(o, s) {
    const [org, repo] = REPO.split('/');
    const d = await vercel('POST', '/v13/deployments', {
      name: `logistics-${o.name}`,
      project: s.vercelProjectId,
      target: 'production',
      gitSource: { type: 'github', org, repo, ref: 'master' },
    });
    s.deploymentUrl = d.url ? `https://${d.url}` : null;
    console.log(`    деплой запущен: ${s.deploymentUrl ?? d.id} — сборка займёт несколько минут`);
  },

  async 'telegram-webhook'(o, s) {
    if (!o.telegramToken) {
      console.log('    пропущено: нет --telegram-token (бота клиента можно подключить позже, docs/PROVISIONING.md §4, §6)');
      return;
    }
    const res = await fetch(`${TELEGRAM_API}/bot${o.telegramToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: `${appUrl(o)}/api/telegram/webhook`, secret_token: s.secrets.telegramWebhookSecret }),
    });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) throw new Error(`setWebhook: ${data.description || res.status}`);
  },

  async 'tenants-file'(o, s) {
    const p = join(ROOT, 'scripts', 'tenants.json');
    const list = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : [];
    if (!list.some((t) => t.name === o.name)) list.push({ name: o.name, url: s.databaseUrl });
    writeFileSync(p, JSON.stringify(list, null, 2) + '\n', { mode: 0o600 });
  },
};

// ---------- запуск ----------
function checkEnv(o) {
  const need = ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_ORG', 'VERCEL_TOKEN'];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length && !o.dryRun) throw new Error(`Нет переменных окружения: ${missing.join(', ')}`);
  if (!process.env.OPS_TELEGRAM_BOT_TOKEN) console.log('ℹ OPS_TELEGRAM_* не заданы — оповещения о сбоях у этого клиента будут выключены');
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
    return;
  }
  const errors = validateOptions(o);
  if (errors.length) throw new Error(errors.join('\n'));
  checkEnv(o);

  const state = loadState(o.name);
  state.secrets ||= generateSecrets(randomBytes);
  state.options = { ...o, telegramToken: o.telegramToken ? '(задан)' : null, dryRun: undefined };
  const todo = nextSteps(state);

  console.log(`Клиент ${o.name} → ${appUrl(o)} · база ${o.region} · функции ${VERCEL_REGION[o.region]}`);
  if (!todo.length) {
    console.log('Все шаги уже выполнены. Состояние: ' + statePath(o.name));
    return;
  }
  if (o.dryRun) {
    console.log('Пробный прогон — будет выполнено:');
    for (const step of todo) console.log(`  · ${step}`);
    console.log('\nПеременные Vercel:');
    for (const e of buildEnv(o, { ...state, supabaseUrl: 'https://<ref>.supabase.co', anonKey: 'anon…', serviceKey: 'service…' }, process.env)) {
      console.log(`  ${e.key} = ${e.type === 'encrypted' ? mask(e.value) : e.value}`);
    }
    return;
  }

  saveState(o.name, state); // секреты на диск ДО создания чего-либо: пароль базы не потеряется
  for (const step of todo) {
    console.log(`→ ${step}`);
    await STEP[step](o, state);
    state.done.push(step);
    saveState(o.name, state);
  }

  console.log(`
✅ Готово: ${o.name}

1. 🔐 Перенесите в менеджер паролей (запись «${o.name}») — всё лежит в ${statePath(o.name)}:
   пароль базы, service_role, CRON_SECRET, BACKUP_ENCRYPTION_KEY, пароль офиса.
2. DNS у регистратора: CNAME ${o.name} → cname.vercel-dns.com
3. Передайте клиенту вход: ${appUrl(o)} · ${o.officeEmail} · пароль из файла состояния
   (попросите сменить его после первого входа). Дальше клиента ведут «Первые шаги» на главной.
4. Ключ расшифровки бэкапов (BACKUP_ENCRYPTION_KEY) — договоритесь, у кого он хранится (docs/PROVISIONING.md).
5. Проверка — docs/PROVISIONING.md §8; сводка: node scripts/tenants-status.mjs scripts/tenants.json
`);
}

main().catch((e) => {
  console.error(`✖ ${e.message}\n  Исправьте причину и запустите ту же команду снова — выполненные шаги пропустятся.`);
  process.exit(1);
});
