/**
 * Напоминание клиенту о просроченных счетах: какие счета попадают в письмо и его текст.
 * Чистая логика — покрыта тестом (lib/__tests__/dunning.test.ts). Текст — словарём
 * на языке КЛИЕНТА (clients.mail_locale), а не того, кто нажал кнопку.
 */
import type { T } from './i18n/translate';
import type { Locale } from './i18n/config';
import type { Receivable } from './receivables';

export const MAIL_LOCALES = ['pl', 'en', 'ru', 'uk'] as const satisfies readonly Locale[];
export type MailLocale = (typeof MAIL_LOCALES)[number];
export const DEFAULT_MAIL_LOCALE: MailLocale = 'pl';

export const mailLocaleOf = (v: unknown): MailLocale =>
  (MAIL_LOCALES as readonly string[]).includes(String(v)) ? (v as MailLocale) : DEFAULT_MAIL_LOCALE;

/** В письмо — только просроченные счета, самые старые первыми. */
export function overdueItems(items: Receivable[]): Receivable[] {
  return items
    .filter((r) => r.daysOverdue != null && r.daysOverdue > 0)
    .sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0));
}

export type ReminderInput = {
  t: T;
  items: Receivable[];
  contactPerson: string | null;
  company: { name: string; accountEur?: string | null; bank?: string | null; email?: string | null };
  money: (n: number) => string;
  date: (iso: string) => string;
};

export function buildReminder({ t, items, contactPerson, company, money, date }: ReminderInput): { subject: string; text: string; total: number } {
  const total = Math.round(items.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  const numbers = items.map((r) => r.invoice_number || `№${r.trip_number ?? '—'}`);
  const subject =
    items.length === 1
      ? t('dun.mailSubjectOne', { invoice: numbers[0], company: company.name })
      : t('dun.mailSubjectMany', { n: items.length, company: company.name });

  const lines = items.map((r) =>
    t('dun.mailLine', {
      invoice: r.invoice_number || `№${r.trip_number ?? '—'}`,
      amount: money(r.amount),
      due: r.due ? date(r.due) : '—',
      days: r.daysOverdue ?? 0,
    }),
  );

  const bank = company.accountEur
    ? ['', t('dun.mailBank'), company.bank ? `${company.bank}` : null, `IBAN: ${company.accountEur}`].filter((x) => x !== null)
    : [];

  const text = [
    contactPerson ? t('dun.mailGreetingNamed', { name: contactPerson }) : t('dun.mailGreeting'),
    '',
    items.length === 1 ? t('dun.mailIntroOne') : t('dun.mailIntroMany'),
    '',
    ...lines,
    '',
    t('dun.mailTotal', { amount: money(total) }),
    ...bank,
    '',
    t('dun.mailPaidAlready'),
    '',
    t('dun.mailSign'),
    company.name,
    ...(company.email ? [company.email] : []),
  ].join('\n');

  return { subject, text, total };
}
