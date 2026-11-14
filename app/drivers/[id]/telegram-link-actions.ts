'use server';

import { randomBytes, createHash } from 'node:crypto';
import { createClient } from '../../../lib/supabase/admin';
import { requireCapability } from '../../../lib/require-office';
import { getCompany } from '../../../lib/company';

// Срок жизни ссылки привязки Telegram.
const TTL_HOURS = 24;

/**
 * Создать одноразовую ссылку привязки Telegram для водителя.
 *
 * В ссылке — случайный токен, а не driver_id: так ссылку нельзя
 * собрать, зная только id водителя, и повторно ею воспользоваться.
 * В базе лежит только SHA-256 токена (миграция 20261113_017).
 */
export async function createDriverTelegramLink(
  driverId: string
): Promise<{ link?: string; error?: string }> {
  await requireCapability('drivers.edit');

  if (!driverId) return { error: 'Водитель не найден' };

  const supabase = await createClient();

  const token = randomBytes(24).toString('base64url'); // 32 символа, допустимо для ?start=
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + TTL_HOURS * 3600 * 1000).toISOString();

  const { error } = await supabase
    .from('driver_telegram_links')
    .insert({ token_hash: tokenHash, driver_id: driverId, expires_at: expiresAt });

  if (error) {
    console.error('[telegram-link] insert failed:', error.message);
    return { error: 'Не удалось создать ссылку' };
  }

  const { telegramBot } = await getCompany();
  if (!telegramBot) {
    return { error: 'Не задан Telegram-бот компании: Настройки → Telegram-бот' };
  }
  return { link: `https://t.me/${telegramBot}?start=${token}` };
}
