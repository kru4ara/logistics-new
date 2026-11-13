#!/usr/bin/env node
/**
 * Расшифровка бэкапа Logistics CRM (файл .json.gz.enc из Telegram).
 *
 *   BACKUP_ENCRYPTION_KEY='<ключ>' node scripts/decrypt-backup.mjs backup_2026-11-14_0700.json.gz.enc
 *
 * Рядом появится backup_2026-11-14_0700.json. Формат — lib/backup-crypto.ts.
 * Зависимостей нет: нужен только Node.js 18+.
 */
import { createDecipheriv } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const MAGIC = Buffer.from('LCRMBAK1', 'ascii');
const IV_LEN = 12;
const TAG_LEN = 16;

function fail(msg) {
  console.error(`Ошибка: ${msg}`);
  process.exit(1);
}

const input = process.argv[2];
if (!input) fail('укажите файл: node scripts/decrypt-backup.mjs <файл.json.gz.enc>');
if (!existsSync(input)) fail(`файл не найден: ${input}`);

const rawKey = (process.env.BACKUP_ENCRYPTION_KEY || '').trim();
if (!rawKey) fail('задайте переменную BACKUP_ENCRYPTION_KEY');
const key = Buffer.from(rawKey, 'base64');
if (key.length !== 32) fail(`ключ должен быть 32 байта в base64 (сейчас ${key.length})`);

const file = readFileSync(input);
if (file.length < MAGIC.length + IV_LEN + TAG_LEN || !file.subarray(0, MAGIC.length).equals(MAGIC)) {
  fail('это не файл бэкапа Logistics CRM (нет заголовка LCRMBAK1)');
}

const iv = file.subarray(MAGIC.length, MAGIC.length + IV_LEN);
const tag = file.subarray(MAGIC.length + IV_LEN, MAGIC.length + IV_LEN + TAG_LEN);
let json;
try {
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const gz = Buffer.concat([decipher.update(file.subarray(MAGIC.length + IV_LEN + TAG_LEN)), decipher.final()]);
  json = gunzipSync(gz).toString('utf8');
} catch {
  fail('не удалось расшифровать: неверный ключ или файл повреждён');
}

const output = input.replace(/\.gz\.enc$/, '').replace(/\.enc$/, '') + (input.endsWith('.json.gz.enc') ? '' : '.json');
writeFileSync(output, json);
const meta = JSON.parse(json).meta || {};
console.log(`Готово: ${output} (таблиц: ${meta.total_tables ?? '?'}, строк: ${meta.total_rows ?? '?'})`);
