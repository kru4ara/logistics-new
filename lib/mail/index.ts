import 'server-only';
import { smtp, isSmtpConfigured } from './smtp';
import type { MailProvider } from './types';

/**
 * Почта компании для писем клиентам: MAIL_PROVIDER=smtp, а если не задан — тот,
 * для которого заданы ключи. Ничего не задано — null (кнопка подскажет, что настроить).
 */
export function getMailProvider(): MailProvider | null {
  const explicit = (process.env.MAIL_PROVIDER ?? '').trim().toLowerCase();
  if (explicit && explicit !== 'smtp') return null;
  return isSmtpConfigured() ? smtp : null;
}
