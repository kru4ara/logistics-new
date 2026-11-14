/**
 * Шифрование бэкапа базы.
 *
 * Бэкап уходит в Telegram — это внешний сервис, и файл лежит в чате
 * бессрочно. Поэтому отправляем только зашифрованный файл:
 *
 *   gzip(JSON) → AES-256-GCM(ключ из BACKUP_ENCRYPTION_KEY)
 *
 * Формат файла .json.gz.enc:
 *   MAGIC (8 байт "LCRMBAK1") | IV (12) | TAG (16) | шифротекст
 *
 * GCM проверяет целостность: испорченный или подменённый файл не
 * расшифруется (ошибка, а не мусор).
 *
 * Расшифровка у себя на компьютере — scripts/decrypt-backup.mjs
 * (тот же формат, без зависимостей). Без ключа бэкап не восстановить:
 * ключ хранить вне Vercel (менеджер паролей).
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

export const BACKUP_MAGIC = Buffer.from('LCRMBAK1', 'ascii');
const IV_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = BACKUP_MAGIC.length + IV_LEN + TAG_LEN;

/**
 * Ключ из base64-строки: ровно 32 байта.
 * Сгенерировать: `openssl rand -base64 32`.
 */
export function parseBackupKey(raw: string | undefined | null): Buffer {
  if (!raw || !raw.trim()) {
    throw new Error('BACKUP_ENCRYPTION_KEY не задан');
  }
  const key = Buffer.from(raw.trim(), 'base64');
  if (key.length !== 32) {
    throw new Error(
      `BACKUP_ENCRYPTION_KEY должен быть 32 байта в base64 (сейчас ${key.length}). Сгенерировать: openssl rand -base64 32`
    );
  }
  return key;
}

export function encryptBackup(json: string, key: Buffer): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(gzipSync(Buffer.from(json, 'utf8'))), cipher.final()]);
  return Buffer.concat([BACKUP_MAGIC, iv, cipher.getAuthTag(), body]);
}

export function decryptBackup(file: Buffer, key: Buffer): string {
  if (file.length < HEADER_LEN || !file.subarray(0, BACKUP_MAGIC.length).equals(BACKUP_MAGIC)) {
    throw new Error('Это не файл бэкапа Logistics CRM (нет заголовка LCRMBAK1)');
  }
  const iv = file.subarray(BACKUP_MAGIC.length, BACKUP_MAGIC.length + IV_LEN);
  const tag = file.subarray(BACKUP_MAGIC.length + IV_LEN, HEADER_LEN);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const gz = Buffer.concat([decipher.update(file.subarray(HEADER_LEN)), decipher.final()]);
  return gunzipSync(gz).toString('utf8');
}
