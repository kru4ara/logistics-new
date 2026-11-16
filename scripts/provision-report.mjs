#!/usr/bin/env node
/**
 * Отправить итог развёртывания владельцу в личный Telegram (OPS_TELEGRAM_BOT_TOKEN,
 * OPS_TELEGRAM_CHAT_ID): вход клиента, строку для TENANTS_JSON, ключ бэкапов.
 * Запускает workflow «Provision tenant» после provision-tenant.mjs; локально:
 *   node scripts/provision-report.mjs <name>
 * Секреты в лог не пишутся.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReport } from './provision-plan.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TELEGRAM_API = process.env.TELEGRAM_API_URL || 'https://api.telegram.org';

const name = process.argv[2];
const path = join(ROOT, 'scripts', 'tenants', `${name}.json`);
if (!name || !existsSync(path)) {
  console.error(`✖ нет состояния клиента: scripts/tenants/${name}.json`);
  process.exit(1);
}
const state = JSON.parse(readFileSync(path, 'utf8'));
const allDone = state.done?.includes('tenants-file');
if (!allDone) {
  console.log('Развёртывание не закончено — отчёт не отправляю.');
  process.exit(0);
}
const token = process.env.OPS_TELEGRAM_BOT_TOKEN;
const chat = process.env.OPS_TELEGRAM_CHAT_ID;
if (!token || !chat) {
  console.error('✖ нет OPS_TELEGRAM_BOT_TOKEN / OPS_TELEGRAM_CHAT_ID — некуда отправить вход клиента');
  process.exit(1);
}
const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: chat, text: buildReport(state.options, state), disable_web_page_preview: true }),
});
const data = await res.json().catch(() => ({}));
if (!data.ok) {
  console.error(`✖ Telegram: ${data.description || res.status}`);
  process.exit(1);
}
console.log('Итог отправлен в Telegram владельца.');
