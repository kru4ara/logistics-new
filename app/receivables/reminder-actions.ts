'use server';

import { revalidatePath } from 'next/cache';
import { loadAllocatedByTrip } from '../../lib/bank/refs';
import { requireCapability } from '../../lib/require-office';
import { createClient } from '../../lib/supabase/admin';
import { logAudit } from '../../lib/audit';
import { getT } from '../../lib/i18n/server';
import { getSessionContext } from '../../lib/session';
import { getCompany } from '../../lib/company';
import { createT } from '../../lib/i18n/translate';
import { MESSAGES } from '../../lib/i18n/messages';
import { DEFAULT_LOCALE, INTL_LOCALE, LOCALE_LABELS } from '../../lib/i18n/config';
import { formatDate } from '../../lib/i18n/format';
import { toReceivable, type ReceivableTrip } from '../../lib/receivables';
import { loadInvoicedTrips } from '../../lib/receivables-load';
import { buildReminder, mailLocaleOf, overdueItems, type MailLocale } from '../../lib/dunning-rules';
import { getMailProvider } from '../../lib/mail';
import { parseRecipients, type MailAttachment } from '../../lib/mail/types';
import { providerById } from '../../lib/invoicing';
import { fetchAllByIds } from '../../lib/fetch-all';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ReminderDraft = {
  ok: boolean;
  message?: string;
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  langLabel?: string;
  pdfCount?: number;
  bcc?: string | null;
};

type ClientRow = { id: string; name: string; email: string | null; contact_person: string | null; payment_days: number | null; mail_locale?: string | null };

/** Клиент — с языком писем (миграция 033); до миграции — без него (польский). */
async function loadClient(supabase: Supabase, clientId: string): Promise<ClientRow | null> {
  const cols = 'id, name, email, contact_person, payment_days';
  const full = await supabase.from('clients').select(`${cols}, mail_locale`).eq('id', clientId).maybeSingle();
  if (!full.error) return full.data as ClientRow | null;
  const old = await supabase.from('clients').select(cols).eq('id', clientId).maybeSingle();
  return old.data as ClientRow | null;
}

async function draftFor(supabase: Supabase, clientId: string) {
  const client = await loadClient(supabase, clientId);
  if (!client) return null;
  const { data: trips } = await loadInvoicedTrips(supabase);
  const today = new Date().toISOString().slice(0, 10);
  // Долг — за вычетом уже пришедшего по выписке.
  const paid = await loadAllocatedByTrip(supabase);
  const items = overdueItems(
    ((trips ?? []) as ReceivableTrip[])
      .filter((tr) => tr.client_id === clientId)
      .map((tr) => toReceivable({ ...tr, paid_part: paid.get(tr.id) ?? 0 }, client.payment_days, today))
      .filter((r) => r.amount > 0.5),
  );
  const locale: MailLocale = mailLocaleOf(client.mail_locale);
  const company = await getCompany();
  const money = (n: number) =>
    new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n);
  const mail = buildReminder({
    t: createT(MESSAGES[locale], MESSAGES[DEFAULT_LOCALE]),
    items,
    contactPerson: client.contact_person,
    company: { name: company.name, accountEur: company.accountEur, bank: company.bank, email: company.email },
    money,
    date: (d) => formatDate(d, locale),
  });
  return { client, items, locale, company, mail };
}

/** Черновик письма — показать перед отправкой. */
export async function prepareReminder(clientId: string): Promise<ReminderDraft> {
  await requireCapability('receivables.edit');
  const { t } = await getT();
  const provider = getMailProvider();
  if (!provider) return { ok: false, message: t('dun.noMail') };
  const supabase = await createClient();
  const d = await draftFor(supabase, clientId);
  if (!d) return { ok: false, message: t('portalAdm.notFound') };
  if (!d.items.length) return { ok: false, message: t('dun.nothing') };

  const { data: inv } = await fetchAllByIds(d.items.map((r) => r.id), (chunk) =>
    supabase.from('trips').select('id, invoice_external_id').in('id', chunk),
  );
  return {
    ok: true,
    from: provider.from,
    to: d.client.email ?? '',
    subject: d.mail.subject,
    text: d.mail.text,
    langLabel: LOCALE_LABELS[d.locale],
    pdfCount: (inv ?? []).filter((r) => r.invoice_external_id).length,
    bcc: d.company.email || null,
  };
}

const MAX_ATTACH_BYTES = 15 * 1024 * 1024;
const safeName = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 80);

async function invoicePdfs(supabase: Supabase, tripIds: string[]): Promise<{ files: MailAttachment[]; failed: string[] }> {
  const { data } = await fetchAllByIds(tripIds, (chunk) =>
    supabase.from('trips').select('id, trip_number, invoice_number, invoice_provider, invoice_external_id').in('id', chunk),
  );
  const files: MailAttachment[] = [];
  const failed: string[] = [];
  let size = 0;
  for (const tr of data ?? []) {
    const label = (tr.invoice_number as string | null) || `№${tr.trip_number ?? '—'}`;
    const provider = providerById(tr.invoice_provider as string | null);
    if (!provider || !tr.invoice_external_id) {
      failed.push(label);
      continue;
    }
    try {
      const buf = Buffer.from(await provider.pdf(tr.invoice_external_id as string));
      if (size + buf.length > MAX_ATTACH_BYTES) {
        failed.push(label);
        continue;
      }
      size += buf.length;
      files.push({ filename: `${safeName(label)}.pdf`, content: buf, contentType: 'application/pdf' });
    } catch (e) {
      console.error('[dunning] pdf', label, e instanceof Error ? e.message : e);
      failed.push(label);
    }
  }
  return { files, failed };
}

/** Отправить напоминание (текст и адреса — как поправил пользователь). */
export async function sendReminder(
  clientId: string,
  input: { to: string; subject: string; text: string; attachPdf: boolean },
): Promise<{ ok: boolean; message?: string; warning?: string }> {
  await requireCapability('receivables.edit');
  const { t } = await getT();
  const provider = getMailProvider();
  if (!provider) return { ok: false, message: t('dun.noMail') };
  const to = parseRecipients(input.to ?? '');
  if (!to) return { ok: false, message: t('dun.badTo') };
  const subject = String(input.subject ?? '').trim().slice(0, 300);
  const text = String(input.text ?? '').trim().slice(0, 20_000);
  if (!subject || !text) return { ok: false, message: t('dun.empty') };

  const supabase = await createClient();
  const d = await draftFor(supabase, clientId);
  if (!d) return { ok: false, message: t('portalAdm.notFound') };
  if (!d.items.length) return { ok: false, message: t('dun.nothing') };
  const tripIds = d.items.map((r) => r.id);

  const { files, failed } = input.attachPdf ? await invoicePdfs(supabase, tripIds) : { files: [], failed: [] };
  const bcc = d.company.email && !to.includes(d.company.email) ? d.company.email : null;

  try {
    await provider.send({ to, subject, text, bcc, replyTo: d.company.email || null, attachments: files });
  } catch (e) {
    return { ok: false, message: t('dun.sendError', { msg: e instanceof Error ? e.message : String(e) }) };
  }

  const session = await getSessionContext();
  const { error: logErr } = await supabase.from('client_reminders').insert({
    client_id: clientId,
    sent_by: session.userName ?? null,
    to_email: to.join(', '),
    locale: d.locale,
    trip_ids: tripIds,
    total_eur: d.mail.total,
    attachments: files.length,
  });
  if (logErr) console.error('[dunning] journal', logErr.message);
  await logAudit({
    entity_type: 'client',
    entity_id: clientId,
    action: 'update',
    changes: {},
    summary: `Напоминание о просрочке «${d.client.name}» → ${to.join(', ')}: ${d.items.length} сч., ${d.mail.total} EUR`,
  });
  revalidatePath('/receivables');
  return { ok: true, warning: failed.length && input.attachPdf ? t('dun.pdfSkipped', { list: failed.join(', ') }) : undefined };
}
