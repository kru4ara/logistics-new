'use server';

import { requireCapability } from '../../lib/require-office';
import { getMailProvider } from '../../lib/mail';
import { MailError } from '../../lib/mail/types';
import { getT } from '../../lib/i18n/server';
import { logAudit } from '../../lib/audit';

/**
 * Тестовое письмо самому ящику компании (адрес «от кого»): проверить SMTP,
 * не беспокоя клиентов. Ошибку сервера почты показываем как есть — по ней видно,
 * что не так (пароль, порт, адрес).
 */
const COMPANY_AUDIT_ID = '00000000-0000-0000-0000-000000000001';

export async function sendTestMail(): Promise<{ ok: boolean; message: string }> {
  await requireCapability('settings.edit');
  const { t } = await getT();
  const provider = getMailProvider();
  if (!provider) return { ok: false, message: t('dun.noMail') };
  const to = provider.from.match(/<([^>]+)>/)?.[1] ?? provider.from;
  try {
    await provider.send({
      to: [to],
      subject: t('mailTest.subject'),
      text: t('mailTest.body', { from: provider.from }),
    });
    await logAudit({ entity_type: 'company', entity_id: COMPANY_AUDIT_ID, action: 'update', summary: `Тестовое письмо отправлено на ${to}` });
    return { ok: true, message: t('mailTest.sent', { to }) };
  } catch (e) {
    const msg = e instanceof MailError || e instanceof Error ? e.message : String(e);
    console.error('[mail] test failed', msg);
    return { ok: false, message: t('mailTest.failed', { msg }) };
  }
}
