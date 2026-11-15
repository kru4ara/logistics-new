/** Отправка писем клиентам — модулем (SMTP ящика компании, позже — другие сервисы). */

export type MailAttachment = { filename: string; content: Buffer; contentType?: string };

export type MailMessage = {
  to: string[];
  subject: string;
  text: string;
  replyTo?: string | null;
  /** скрытая копия — чтобы письмо осталось у компании */
  bcc?: string | null;
  attachments?: MailAttachment[];
};

export type MailProvider = {
  id: string;
  /** адрес «от кого» — показываем в форме перед отправкой */
  from: string;
  send(msg: MailMessage): Promise<{ id: string | null }>;
};

export class MailError extends Error {}

/** Адреса через запятую / точку с запятой → список; null — есть некорректный. */
export function parseRecipients(raw: string): string[] | null {
  const list = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!list.length || list.length > 10) return null;
  return list.every((a) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(a)) ? list : null;
}
