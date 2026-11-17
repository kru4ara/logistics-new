// Выписка PKO BP (PDF «WYCIĄG») → операции. Чистые правила: на вход — строки текста
// страниц (текстовые куски через 3+ пробела, как отдаёт lib/bank/pdf-text.ts).

export type ParsedTx = {
  /** порядковый номер в выписке — для ключа повторной загрузки */
  seq: number;
  bookingDate: string; // YYYY-MM-DD
  valueDate: string | null;
  operationId: string;
  type: string;
  /** со знаком: приход > 0, расход < 0 */
  amount: number;
  balance: number | null;
  description: string;
  counterparty: string | null;
  counterpartyAccount: string | null;
  title: string | null;
};

export type ParsedStatement = {
  account: string; // 26 цифр
  currency: string;
  periodFrom: string;
  periodTo: string;
  number: string | null;
  openingBalance: number | null;
  closingBalance: number | null;
  transactions: ParsedTx[];
};

export type ParseError = 'notPko' | 'noAccount' | 'noPeriod' | 'empty' | 'balance';

const SEP = /\s{3,}/;
const DATE = /^\d{2}\.\d{2}\.\d{4}$/;
const MONEY = /^-?\d{1,3}(?: \d{3})*,\d{2}$/;

export const plDate = (d: string) => `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}`;
export const plMoney = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'));
const digits = (s: string) => s.replace(/\D/g, '');
/** Счёт без пробелов; польский IBAN — 26 цифр без «PL». */
export const compactAccount = (s: string) => {
  const c = s.replace(/\s/g, '').toUpperCase();
  return /^PL\d{26}$/.test(c) ? c.slice(2) : c;
};

/** Строки колонтитулов и шапки страниц — не часть описания операции. */
const NOISE = [
  /^Saldo (do|z) przeniesienia/,
  /^Niniejszy dokument/,
  /^Powszechna Kasa/,
  /^Sąd Rejonowy/,
  /^NIP: 525-000-77-38/,
  /^www\.pkobp\.pl/,
  /^w pozostałych przypadkach/,
  /^\+48 81 535/,
  /^WYCIĄG za okres/,
  /^Nr: \d+\/\d{4}/,
  /^Nr rachunku\/karty/,
  /^Data operacji/,
  /^Data waluty/,
];

/** Счёт контрагента в описании: 26 цифр (с пробелами или без), IBAN с буквами страны. */
const ACCOUNT_RE = /\b(?:[A-Z]{2}\d{2}[A-Z0-9]{10,30}|\d{2}(?: ?\d{4}){6})\b/;

function fields(type: string, desc: string): Pick<ParsedTx, 'counterparty' | 'counterpartyAccount' | 'title'> {
  const d = desc.replace(/\s+/g, ' ').trim();
  // Заграничные: «Zlec.: … Rach. zlec.: … Benef.: … Rach. benef.: … tyt.: … Kwota oryg.: …»
  if (/\b(Zlec\.|Benef\.):/.test(d)) {
    const pick = (re: RegExp) => d.match(re)?.[1]?.trim() || null;
    const incoming = /^UZN|PRZYCHODZ/.test(type);
    const name = incoming
      ? pick(/Zlec\.: (.+?)(?= Ident\. zlec\.:| Rach\. zlec\.:| Benef\.:| tyt\.:|$)/)
      : pick(/Benef\.: (.+?)(?= Rach\. benef\.:| tyt\.:|$)/);
    const acct = incoming
      ? pick(/Rach\. zlec\.: ([A-Z0-9][A-Z0-9 ]{8,44}?)(?= Benef\.:| tyt\.:|$)/)
      : pick(/Rach\. benef\.: ([A-Z0-9][A-Z0-9 ]{8,44}?)(?= tyt\.:|$)/);
    const title = pick(/tyt\.: (.+?)(?= Kwota oryg\.:|$)/);
    return { counterparty: name, counterpartyAccount: acct ? compactAccount(acct) : null, title };
  }
  // Карта: «Karta:… Lokalizacja: STACJA PALIW … Nr ref: …»
  if (/^Karta:/.test(d)) {
    const loc = d.match(/Lokalizacja: (.+?)(?= Nr ref:|$)/)?.[1]?.trim() ?? null;
    return { counterparty: loc, counterpartyAccount: null, title: null };
  }
  // Внутренние: «<назначение> <счёт> <НАЗВАНИЕ…>» (Ref. wł. zlec. — хвост банка).
  const clean = d.replace(/ Ref\. wł\. zlec\.: \S+/g, '').replace(/ Kwota oryg\.: .*$/, '');
  const m = clean.match(ACCOUNT_RE);
  if (m && m.index != null) {
    return {
      title: clean.slice(0, m.index).trim() || null,
      counterpartyAccount: compactAccount(m[0]),
      counterparty: clean.slice(m.index + m[0].length).trim() || null,
    };
  }
  return { counterparty: null, counterpartyAccount: null, title: clean || null };
}

/** Разобрать текст выписки PKO. */
export function parsePkoStatement(lines: string[]): { ok: true; statement: ParsedStatement } | { ok: false; error: ParseError } {
  const text = lines.join('\n');
  if (!/pkobp|PKO B/i.test(text) || !/WYCIĄG za okres/.test(text)) return { ok: false, error: 'notPko' };
  const acct = text.match(/Nr rachunku\/karty: ([\d ]{26,40})/)?.[1];
  if (!acct || digits(acct).length !== 26) return { ok: false, error: 'noAccount' };
  const period = text.match(/WYCIĄG za okres (\d{2}\.\d{2}\.\d{4}) - (\d{2}\.\d{2}\.\d{4})/);
  if (!period) return { ok: false, error: 'noPeriod' };
  const currency = text.match(/Waluta rachunku: ([A-Z]{3})/)?.[1] ?? 'PLN';
  const money = (re: RegExp) => {
    const v = text.match(re)?.[1];
    return v ? plMoney(v) : null;
  };

  const txs: ParsedTx[] = [];
  let started = false;
  let cur: ParsedTx | null = null;
  let desc: string[] = [];
  const flush = () => {
    if (!cur) return;
    cur.description = desc.join(' ').replace(/\s+/g, ' ').trim();
    Object.assign(cur, fields(cur.type, cur.description));
    txs.push(cur);
    cur = null;
    desc = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^Saldo poprzednie/.test(line)) { started = true; continue; }
    if (!started) continue;
    if (/^Saldo końcowe/.test(line)) { flush(); break; }
    if (NOISE.some((re) => re.test(line))) continue;
    const parts = line.split(SEP);
    if (parts.length >= 5 && DATE.test(parts[0]) && MONEY.test(parts[parts.length - 2]) && MONEY.test(parts[parts.length - 1])) {
      flush();
      cur = {
        seq: txs.length + 1,
        bookingDate: plDate(parts[0]),
        valueDate: null,
        operationId: parts[1],
        type: parts.slice(2, -2).join(' '),
        amount: plMoney(parts[parts.length - 2]),
        balance: plMoney(parts[parts.length - 1]),
        description: '',
        counterparty: null,
        counterpartyAccount: null,
        title: null,
      };
      continue;
    }
    if (!cur) continue;
    // Первая строка описания начинается с даты валютирования.
    if (!desc.length && DATE.test(parts[0])) {
      (cur as ParsedTx).valueDate = plDate(parts[0]);
      desc.push(parts.slice(1).join(' '));
    } else desc.push(parts.join(' '));
  }
  flush();
  if (!txs.length) return { ok: false, error: 'empty' };

  const opening = money(/Saldo poprzednie\s+(-?[\d ]+,\d{2})/);
  const closing = money(/Saldo końcowe\s+(-?[\d ]+,\d{2})/);
  // Сверка: начальный остаток + операции = конечный (выписка прочитана целиком).
  if (opening != null && closing != null) {
    const sum = Math.round((opening + txs.reduce((s, t) => s + t.amount, 0)) * 100);
    if (Math.abs(sum - Math.round(closing * 100)) > 1) return { ok: false, error: 'balance' };
  }
  return {
    ok: true,
    statement: {
      account: digits(acct),
      currency,
      periodFrom: plDate(period[1]),
      periodTo: plDate(period[2]),
      number: text.match(/Nr: (\d+\/\d{4})/)?.[1] ?? null,
      openingBalance: opening,
      closingBalance: closing,
      transactions: txs,
    },
  };
}
