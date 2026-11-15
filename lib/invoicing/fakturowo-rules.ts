// Fakturowo.pl: чистые правила (параметры запроса, разбор ответа) — покрыты тестами.
// API: POST https://www.fakturowo.pl/api, поля формы; ответ — строки текста:
// 1-я строка «1» (успех) или «0» (ошибка), 2-я — api_numer или текст ошибки.
// В KSeF Fakturowo через API не отправляет: кнопка «Wyślij do KSeF» в их программе.
import type { InvoiceInput } from '../invoice-rules';
import { EU_COUNTRIES } from '../invoice-rules';

/** «2026-11-15» → «15-11-2026». */
export const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;

/** Предыдущий рабочий день (курс NBP — с последнего рабочего дня до даты; праздники не учитываем). */
export function previousWorkday(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  do d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

/** Тип документа и ставка Fakturowo по нашему выбору НДС. */
export function fakturowoKind(i: Pick<InvoiceInput, 'tax' | 'npKind'>): { rodzaj: string; stawka: string } {
  if (i.tax === 'np' && i.npKind === 'export_service_eu') return { rodzaj: '49', stawka: 'npII' };
  if (i.tax === 'np' && i.npKind === 'export_service') return { rodzaj: '48', stawka: 'npI' };
  return { rodzaj: '0', stawka: i.tax };
}

/** Вид номера покупателя: 0 — NIP, 2 — VAT UE, 3 — иной налоговый номер. */
export function nipKind(country: string | null, taxId: string): '0' | '2' | '3' {
  if (!country || country === 'PL') return '0';
  if ((EU_COUNTRIES as readonly string[]).includes(country) && /^[A-Z]{2}/.test(taxId)) return '2';
  return '3';
}

/** Код оплаты: точные 14/30/60 дней — готовые коды, иначе «przelew» + дата срока. */
const ZAPLATA_BY_DAYS: Record<number, string> = { 14: '8', 30: '10', 60: '11' };

export function buildFakturowoParams(
  i: InvoiceInput,
  paymentDue: string,
  bankAccount: string | null,
): Record<string, string> {
  const { rodzaj, stawka } = fakturowoKind(i);
  const p: Record<string, string> = {
    api_zadanie: '1',
    api_kodowanie: '0',
    dokument_rodzaj: rodzaj,
    dokument_data_w: ddmmyyyy(i.issueDate),
    dokument_data_s: ddmmyyyy(i.sellDate),
    dokument_waluta: i.currency === 'EUR' ? '1' : '0',
    dokument_zaplata: ZAPLATA_BY_DAYS[i.paymentDays] ?? '0',
    dokument_termin: ddmmyyyy(paymentDue),
    dokument_status: '0',
    dokument_dostep: '1',
    nabywca_nazwa: i.buyer.name.trim(),
    nabywca_nip: i.buyer.taxId ?? '',
    nabywca_nip_oznaczenie: nipKind(i.buyer.country, i.buyer.taxId ?? ''),
    nabywca_ulica: i.buyer.street ?? '',
    nabywca_kod: i.buyer.postCode ?? '',
    nabywca_miasto: i.buyer.city ?? '',
    nabywca_kraj: i.buyer.country ?? 'PL',
    produkt_nazwa: i.positionName.trim(),
    produkt_jm: '1',
    produkt_ilosc: '1',
    produkt_cena_netto: (Math.round(i.netAmount * 100) / 100).toFixed(2),
    produkt_stawka_vat: stawka,
  };
  // НДС в валюте нужно показать и в злотых — по курсу NBP; без НДС пересчёт не нужен.
  if (i.currency !== 'PLN' && /^\d+$/.test(stawka) && Number(stawka) > 0) {
    p.dokument_przelicz_walute = 'PLN';
    p.dokument_rodzaj_kursu = '0';
    p.dokument_data_wymiany = ddmmyyyy(previousWorkday(i.sellDate));
  }
  if (i.buyer.email) p.nabywca_email = i.buyer.email;
  if (bankAccount) p.dokument_konto = bankAccount;
  // У типов 48/49 пометка о «np»/odwrotne obciążenie уже в самом документе.
  const note = [rodzaj === '0' && i.reverseCharge ? 'Odwrotne obciążenie' : null, i.note?.trim() || null]
    .filter(Boolean)
    .join('\n');
  if (note) p.dokument_uwagi = note;
  return p;
}

export type FakturowoReply = { ok: true; lines: string[] } | { ok: false; error: string };

/** Ответ API: «1\n…» или «0\nописание ошибки». */
export function parseReply(text: string): FakturowoReply {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim());
  if (lines[0] === '1') return { ok: true, lines: lines.slice(1) };
  return { ok: false, error: lines.slice(1).filter(Boolean).join(' ') || text.trim().slice(0, 300) || 'empty response' };
}

export type FakturowoDoc = { apiNumer: string; number: string | null; ksefNumber: string | null; status: string | null };

/**
 * Строка списка документов (api_zadanie=3), поля через «;»:
 * 1 api_numer, 3 dokument_numer, 16 dokument_status, 19 numer ksef (последнее).
 * Ищем строку нужного документа: за ней идут строки позиций.
 */
export function parseDocList(lines: string[], apiNumer: string): FakturowoDoc | null {
  // lines[0] — число страниц, дальше строки документов.
  for (const line of lines.slice(1)) {
    const f = line.split(';').map((x) => x.trim());
    if (f[0] !== apiNumer || f.length < 19) continue;
    return {
      apiNumer,
      number: f[2] || null,
      ksefNumber: f[f.length - 1] || null,
      status: f[f.length - 4] || null,
    };
  }
  return null;
}
