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

/** Номер KSeF: NIP-ГГГГММДД-12 hex-12-2 hex, например 7011162939-20261114-52D8B6C00001-C4. */
export const KSEF_NUMBER_RE = /\b\d{10}-\d{8}-[0-9A-F]{12}-[0-9A-F]{2}\b/i;

/** «13-11-2026», «13.11.2026» или «2026-11-13» → «2026-11-13»; не дата — null. */
export function isoFromDdMmYyyy(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = /^(\d{2})[-.](\d{2})[-.](\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Срок из способа оплаты: «przelew w terminie 10 dni» / код 8, 10, 11 (14, 30, 60 дней). */
export function daysFromZaplata(v: string | null | undefined): number | null {
  const s = (v ?? '').trim();
  const m = /(\d{1,3})\s*dni/i.exec(s);
  if (m) return Number(m[1]);
  const byCode: Record<string, number> = { '8': 14, '10': 30, '11': 60 };
  return byCode[s] ?? null;
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Документ из списка Fakturowo (api_zadanie=3). */
export type FakturowoDoc = {
  apiNumer: string;
  kind: string | null;
  number: string | null;
  issueDate: string | null;
  currency: string | null;
  gross: number | null;
  buyerName: string | null;
  buyerTaxId: string | null;
  /** 0 — не оплачена, 1 — оплачена, 2 — частично */
  status: string | null;
  paymentDue: string | null;
  ksefNumber: string | null;
};

const num = (v: string | undefined) => {
  const n = Number((v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && v?.trim() ? n : null;
};

/**
 * Строка документа, поля через «;» (19 штук):
 * 1 api_numer, 2 rodzaj, 3 numer, 4 data_w, 5 data_s, 6 waluta, 7–9 netto/vat/brutto,
 * 10–12 продавец, 13–15 покупатель, 16 status, 17 zaplata, 18 termin, 19 numer ksef.
 * Адреса могут содержать «;», поэтому начало читаем с начала, конец — с конца.
 * Строки позиций (без даты в 4-м поле) — не документы.
 */
/** Статус оплаты → код: 1 — оплачена, 2 — частично, 0 — нет (понимает и код, и текст). */
export function paymentCode(v: string | null | undefined): '0' | '1' | '2' {
  const s = (v ?? '').trim().toLowerCase();
  if (s === '1') return '1';
  if (s === '2' || /cz[eę][sś]ciow/.test(s) || /partial/.test(s)) return '2';
  if (/^(nie|un)/.test(s)) return '0';
  if (/zap[łl]acon|op[łl]acon|^paid/.test(s)) return '1';
  return '0';
}

export function parseDocRow(line: string): FakturowoDoc | null {
  const f = line.split(';').map((x) => x.trim());
  // Строки часто заканчиваются «;» — пустое последнее поле сдвигало бы поля, считанные с конца.
  while (f.length > 19 && f[f.length - 1] === '') f.pop();
  if (f.length < 19 || !/^\d+$/.test(f[0]) || !isoFromDdMmYyyy(f[3])) return null;
  // Ровно 19 полей — читаем по номерам; больше («;» внутри адреса) — конец строки с конца.
  const at = f.length === 19 ? { buyerTaxId: 14, status: 15, zaplata: 16, termin: 17, ksef: 18 } : null;
  const fromEnd = (k: number) => f[f.length - k];
  const buyerTaxId = at ? f[at.buyerTaxId] : fromEnd(5);
  const statusRaw = at ? f[at.status] : fromEnd(4);
  const zaplata = at ? f[at.zaplata] : fromEnd(3);
  const termin = at ? f[at.termin] : fromEnd(2);
  const ksefField = at ? f[at.ksef] : fromEnd(1);
  const ksef = ksefField?.match(KSEF_NUMBER_RE)?.[0] ?? line.match(KSEF_NUMBER_RE)?.[0] ?? null;
  const issueDate = isoFromDdMmYyyy(f[3]);
  const days = daysFromZaplata(zaplata);
  return {
    apiNumer: f[0],
    kind: f[1] || null,
    number: f[2] || null,
    issueDate,
    currency: f[5] || null,
    gross: num(f[8]),
    buyerName: f[12] || null,
    buyerTaxId: buyerTaxId || null,
    status: paymentCode(statusRaw),
    // Срок: поле termin; пустое — из способа оплаты («przelew w terminie N dni»).
    paymentDue: isoFromDdMmYyyy(termin) ?? (issueDate && days != null ? addDays(issueDate, days) : null),
    ksefNumber: ksef,
  };
}

/** Все документы со страницы списка: lines[0] — число страниц, дальше строки. */
export function parseDocPage(lines: string[]): { pages: number; docs: FakturowoDoc[] } {
  const pages = Number(lines[0]) || 0;
  const docs = lines.slice(1).map(parseDocRow).filter((d): d is FakturowoDoc => d !== null);
  return { pages, docs };
}

/** Нужный документ в ответе — где бы ни была его строка (с номером страниц или без). */
export function parseDocList(lines: string[], apiNumer: string): FakturowoDoc | null {
  for (const line of lines) {
    const d = parseDocRow(line);
    if (d && d.apiNumer === apiNumer) return d;
  }
  return null;
}
