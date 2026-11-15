import { describe, it, expect, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { toReceivable } from '../receivables';
import { buildReminder, overdueItems, mailLocaleOf } from '../dunning-rules';
import { parseRecipients } from '../mail/types';
import { createT } from '../i18n/translate';
import { MESSAGES } from '../i18n/messages';

vi.mock('server-only', () => ({}));

const today = '2026-11-16';
const r = (id: string, due: string, amount: number, invoice: string | null) =>
  toReceivable(
    { id, trip_number: id, invoice_number: invoice, client_id: 'c', revenue_eur: amount, invoiced_at: null, payment_due: due, end_date: null },
    30,
    today,
  );

describe('напоминание о просрочке', () => {
  it('в письмо — только просроченные, самые старые первыми', () => {
    const items = [r('1', '2026-11-20', 100, 'FV 1'), r('2', '2026-11-10', 200, 'FV 2'), r('3', '2026-10-01', 300, 'FV 3')];
    expect(overdueItems(items).map((x) => x.id)).toEqual(['3', '2']);
  });

  it('текст на языке клиента: счета, итог, реквизиты', () => {
    const t = createT(MESSAGES.pl, MESSAGES.ru);
    const items = overdueItems([r('2', '2026-11-10', 200, 'FV 2/11/2026'), r('3', '2026-10-01', 300.5, null)]);
    const m = buildReminder({
      t,
      items,
      contactPerson: 'Jan',
      company: { name: 'Raibuilding', accountEur: 'PL00 1111', bank: 'mBank', email: 'biuro@x.pl' },
      money: (n) => `${n.toFixed(2)} EUR`,
      date: (d) => d.split('-').reverse().join('.'),
    });
    expect(m.total).toBe(500.5);
    expect(m.subject).toBe('Przypomnienie o płatności: faktury po terminie — 2 (Raibuilding)');
    expect(m.text).toContain('Dzień dobry, Jan,');
    expect(m.text).toContain('• №3 — 300.50 EUR, termin płatności 01.10.2026 (46 dni po terminie)');
    expect(m.text).toContain('• FV 2/11/2026 — 200.00 EUR');
    expect(m.text).toContain('Razem do zapłaty: 500.50 EUR');
    expect(m.text).toContain('IBAN: PL00 1111');
    expect(m.text.trim().endsWith('biuro@x.pl')).toBe(true);
  });

  it('одна фактура — тема с номером; без счёта в банке — без реквизитов', () => {
    const t = createT(MESSAGES.en, MESSAGES.ru);
    const m = buildReminder({
      t,
      items: overdueItems([r('2', '2026-11-10', 200, 'FV 2')]),
      contactPerson: null,
      company: { name: 'ACME' },
      money: String,
      date: String,
    });
    expect(m.subject).toBe('Payment reminder: invoice FV 2 (ACME)');
    expect(m.text.startsWith('Dear Sir or Madam,')).toBe(true);
    expect(m.text).not.toContain('IBAN');
  });

  it('язык письма по умолчанию — польский', () => {
    expect(mailLocaleOf('en')).toBe('en');
    expect(mailLocaleOf(null)).toBe('pl');
    expect(mailLocaleOf('de')).toBe('pl');
  });

  it('адреса получателей', () => {
    expect(parseRecipients('a@b.pl, c@d.com; e@f.eu')).toEqual(['a@b.pl', 'c@d.com', 'e@f.eu']);
    expect(parseRecipients('a@b')).toBeNull();
    expect(parseRecipients('  ')).toBeNull();
    expect(parseRecipients('a@b.pl, x')).toBeNull();
  });
});

describe('SMTP-модуль', () => {
  it('собирает письмо: от кого, скрытая копия, ответ, вложения', async () => {
    process.env.SMTP_HOST = 'smtp.test';
    process.env.SMTP_USER = 'biuro@x.pl';
    process.env.SMTP_PASSWORD = 'p';
    process.env.SMTP_FROM = 'Raibuilding <biuro@x.pl>';
    const { smtp, __setTransportForTests } = await import('../mail/smtp');
    const { getMailProvider } = await import('../mail');
    const sent: any[] = [];
    __setTransportForTests(() => {
      const tr = nodemailer.createTransport({ jsonTransport: true });
      const orig = tr.sendMail.bind(tr);
      tr.sendMail = (async (m: any) => {
        const info = await orig(m);
        sent.push(JSON.parse(String((info as any).message)));
        return info;
      }) as any;
      return tr;
    });
    expect(getMailProvider()?.id).toBe('smtp');
    expect(smtp.from).toBe('Raibuilding <biuro@x.pl>');
    await smtp.send({
      to: ['k@client.de'],
      subject: 'Temat',
      text: 'Treść',
      bcc: 'biuro@x.pl',
      replyTo: 'biuro@x.pl',
      attachments: [{ filename: 'FV.pdf', content: Buffer.from('%PDF'), contentType: 'application/pdf' }],
    });
    expect(sent[0]).toMatchObject({ subject: 'Temat', text: 'Treść' });
    expect(sent[0].from.address).toBe('biuro@x.pl');
    expect(sent[0].to[0].address).toBe('k@client.de');
    expect(sent[0].bcc[0].address).toBe('biuro@x.pl');
    expect(sent[0].attachments[0].filename).toBe('FV.pdf');
  });
});
