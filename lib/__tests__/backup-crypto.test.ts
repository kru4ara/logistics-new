import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { encryptBackup, decryptBackup, parseBackupKey, BACKUP_MAGIC } from '../backup-crypto';

const keyB64 = randomBytes(32).toString('base64');
const key = parseBackupKey(keyB64);
const sample = JSON.stringify({
  created_at: '2026-11-14T07:00:00Z',
  tables: { drivers: { count: 1, rows: [{ id: 'd1', last_name: 'KAVALIOU', phone_pl: '+48 600 000 000' }] } },
  meta: { total_tables: 1, total_rows: 1 },
});

describe('parseBackupKey', () => {
  it('без ключа — понятная ошибка', () => {
    expect(() => parseBackupKey(undefined)).toThrow(/не задан/);
    expect(() => parseBackupKey('   ')).toThrow(/не задан/);
  });

  it('ключ не 32 байта — ошибка с подсказкой', () => {
    expect(() => parseBackupKey(randomBytes(16).toString('base64'))).toThrow(/openssl rand -base64 32/);
  });

  it('32 байта в base64 — ок (пробелы по краям допустимы)', () => {
    expect(parseBackupKey(`  ${keyB64}\n`)).toHaveLength(32);
  });
});

describe('encryptBackup / decryptBackup', () => {
  it('туда и обратно без потерь', () => {
    expect(decryptBackup(encryptBackup(sample, key), key)).toBe(sample);
  });

  it('в файле нет открытых данных', () => {
    const file = encryptBackup(sample, key);
    expect(file.subarray(0, 8).equals(BACKUP_MAGIC)).toBe(true);
    const text = file.toString('latin1');
    expect(text).not.toContain('KAVALIOU');
    expect(text).not.toContain('drivers');
  });

  it('каждый раз новый IV — одинаковые данные дают разные файлы', () => {
    expect(encryptBackup(sample, key).equals(encryptBackup(sample, key))).toBe(false);
  });

  it('чужой ключ — ошибка, а не мусор', () => {
    const other = parseBackupKey(randomBytes(32).toString('base64'));
    expect(() => decryptBackup(encryptBackup(sample, key), other)).toThrow();
  });

  it('испорченный байт — ошибка (GCM проверяет целостность)', () => {
    const file = encryptBackup(sample, key);
    file[file.length - 1] ^= 0xff;
    expect(() => decryptBackup(file, key)).toThrow();
  });

  it('не наш файл — понятная ошибка', () => {
    expect(() => decryptBackup(Buffer.from('{"plain":"json"}'), key)).toThrow(/LCRMBAK1/);
  });

  it('сжимает: повторяющиеся строки занимают меньше исходного JSON', () => {
    const big = JSON.stringify({ rows: Array.from({ length: 2000 }, (_, i) => ({ id: i, status: 'completed', currency: 'EUR' })) });
    expect(encryptBackup(big, key).length).toBeLessThan(big.length / 3);
  });
});

describe('scripts/decrypt-backup.mjs', () => {
  const script = resolve(__dirname, '../../scripts/decrypt-backup.mjs');

  it('расшифровывает файл, созданный сервером', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bk-'));
    const enc = join(dir, 'backup_2026-11-14_0700.json.gz.enc');
    writeFileSync(enc, encryptBackup(sample, key));

    const out = execFileSync(process.execPath, [script, enc], {
      env: { ...process.env, BACKUP_ENCRYPTION_KEY: keyB64 },
      encoding: 'utf8',
    });

    expect(out).toMatch(/строк: 1/);
    expect(readFileSync(join(dir, 'backup_2026-11-14_0700.json'), 'utf8')).toBe(sample);
  });

  it('с неверным ключом — код выхода 1', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bk-'));
    const enc = join(dir, 'b.json.gz.enc');
    writeFileSync(enc, encryptBackup(sample, key));
    expect(() =>
      execFileSync(process.execPath, [script, enc], {
        env: { ...process.env, BACKUP_ENCRYPTION_KEY: randomBytes(32).toString('base64') },
        stdio: 'pipe',
      })
    ).toThrow();
  });
});
