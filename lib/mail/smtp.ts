import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { MailError, type MailProvider } from './types';

/**
 * SMTP почтового ящика компании (biuro@firma.pl и т. п.).
 * SMTP_HOST, SMTP_PORT (465 — SSL, 587 — STARTTLS), SMTP_USER, SMTP_PASSWORD,
 * SMTP_FROM — «Название <biuro@firma.pl>» (по умолчанию SMTP_USER).
 */
export const isSmtpConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);

let cached: Transporter | null = null;
let transportFactory = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: (Number(process.env.SMTP_PORT) || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });

/** Только для тестов: подменить транспорт. */
export function __setTransportForTests(factory: () => Transporter) {
  transportFactory = factory;
  cached = null;
}

const fromAddress = () => (process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();

export const smtp: MailProvider = {
  id: 'smtp',
  get from() {
    return fromAddress();
  },
  async send(msg) {
    cached ??= transportFactory();
    try {
      const info = await cached.sendMail({
        from: fromAddress(),
        to: msg.to,
        bcc: msg.bcc || undefined,
        replyTo: msg.replyTo || undefined,
        subject: msg.subject,
        text: msg.text,
        attachments: msg.attachments,
      });
      return { id: (info.messageId as string | undefined) ?? null };
    } catch (e) {
      cached = null;
      throw new MailError(e instanceof Error ? e.message : String(e));
    }
  },
};
