/**
 * Настройки компании — чистые правила без Supabase (юнит-тесты).
 *
 * Хранение: таблица public.company_settings (одна строка, миграция 022),
 * чтение — getCompany() в lib/company.ts, правка — страница /settings.
 *
 * LEGACY_COMPANY — реквизиты RAIBUILDING, которые раньше были зашиты в
 * коде. Используются, ТОЛЬКО пока на базе нет таблицы company_settings
 * (миграция 022 не применена) — это может быть лишь прежняя единственная
 * база. Миграция 022 заполняет ими строку только там, где уже есть заказы.
 *
 * UNCONFIGURED_COMPANY — таблица есть, строки нет: новая база клиента,
 * настройки ещё не заполнены. Никаких чужих реквизитов.
 */

export type Company = {
  /** Полное юридическое название: шапка заявки, подвал страницы входа. */
  name: string;
  /** Короткое название: страница входа. */
  shortName: string;
  address: string;
  city: string;
  nip: string;
  regon: string;
  eori: string;
  bank: string;
  accountEur: string;
  accountPln: string;
  email: string;
  /** Условия перевозки в заявке. Подстановки: см. TERM_PLACEHOLDERS. */
  terms: string[];
  /** Имя Telegram-бота без @ — для ссылки привязки водителя. */
  telegramBot: string | null;
  /**
   * Домен старых логинов без e-mail: «Иванов» → «Иванов@<домен>».
   * У новых компаний не нужен (null).
   */
  legacyLoginDomain: string | null;
};

export const TERM_PLACEHOLDERS = {
  '{payment_days}': 'срок оплаты в днях',
  '{documents}': 'какие документы нужны для оплаты (оригинал CMR или сканы)',
  '{email}': 'e-mail компании',
} as const;

const DOCS_ORIGINALS = 'oryginała CMR (potwierdzonego podpisem, pieczątką odbiorcy)';
const DOCS_SCANS =
  'skanów CMR (potwierdzonych podpisem, pieczątką odbiorcy) przesłanych drogą mailową';

export const LEGACY_COMPANY: Company = {
  name: 'RAIBUILDING SP. Z O.O.',
  shortName: 'RAIBUILDING',
  address: 'PL21-345 WOLA OSOWIŃSKA, ul. PARKOWA 12',
  city: 'WOLA OSOWIŃSKA',
  nip: '7011162939',
  regon: '526314665',
  eori: 'PL701116293900000',
  bank: 'PKO Bank Polski S.A. - SWIFT BPKOPLPW',
  accountEur: 'PL25 1020 3206 0000 8302 0215 5406',
  accountPln: 'PL82 1020 3206 0000 8402 0215 5398',
  email: 'raibuilding.pl@gmail.com',
  telegramBot: 'raibuilding_bot',
  legacyLoginDomain: 'raibuilding.local',
  terms: [
    '1) Termin płatności {payment_days} dni po dostarczeniu {documents} oraz prawidłowo wystawionej faktury, vat = 0% (Część transportu drogowego, stawka podatku vat wynosi 0%, zgodnie z przepisami art. 28b, ust.1 w odniesieniu do art 83 ust 1pkt 23 ustawy o podatku od towarów i usług, trasa stanowi czesc transportu miedzynarodowego w rozumieniu przepisów rozporzadzenia ministra finansów z dn 28 listopada 2008 par 9 ust 1 pkt 1 i 2.)',
    '2) W celu terminowej płatności, przed wysłaniem dokumentów, należy przesłać skan faktury i CMR na {email}',
    '3) Ustalony normatywny postój na terenie UE-24 godziny, BY/RUS-48 godzin. Opłata ponadnormatywnego postoju wynosi 100 EUR za każde rozpoczęte dobę.',
    '4) Faktura powinna być wystawiona w miesiącu wykonania usługi!!! Data zakończenia dostawy/usługi = dacie rozładunku.',
    '5) Za opóźnienie na załadunek powyżej godziny przewoźnik może być obciążany mandatem 30 EUR za każde rozpoczętą godzinę opóźnienia, ale nie więcej 300 EUR za dobę.',
    '6) ZAKAZ POKAZYWANIA NASZEGO ZLECENIA NA MIEJSCU ZAŁADUNKU i ROZŁADUNKU!!!',
    '7) Kierowca ma pilnować sprawność towaru pod czas załadunku i rozładunku. Po załadunku wysłać zdjęcie załadowanego towaru i dokumentów!!!',
    '8) Przeładunek towaru w tranzycie jest zabroniony! Mandat 1000 euro.',
    '9) W przypadku braku podstawienia pojazdu w ustalonym terminie, przewoźnik ponosi karę umowną w wysokości 500 EUR.',
    '10) Przewoźnik zobowiązany jest do stałego kontaktu telefonicznego z kierowcą i przekazywania statusów na żądanie zleceniodawcy.',
  ],
};

export const UNCONFIGURED_COMPANY: Company = {
  name: 'Компания не настроена',
  shortName: 'Logistics CRM',
  address: '',
  city: '',
  nip: '',
  regon: '',
  eori: '',
  bank: '',
  accountEur: '',
  accountPln: '',
  email: '',
  terms: [],
  telegramBot: null,
  legacyLoginDomain: null,
};

/** Условия перевозки с подставленными значениями. */
export function renderTerms(
  company: Pick<Company, 'terms' | 'email'>,
  paymentDays: number,
  docType: 'originals' | 'scans' = 'originals'
): string[] {
  const docs = docType === 'scans' ? DOCS_SCANS : DOCS_ORIGINALS;
  return company.terms.map((t) =>
    t
      .split('{payment_days}').join(String(paymentDays))
      .split('{documents}').join(docs)
      .split('{email}').join(company.email)
  );
}

/** Строка таблицы company_settings → Company. Пустое название — «не настроена». */
export type CompanyRow = {
  name: string | null;
  short_name: string | null;
  address: string | null;
  city: string | null;
  nip: string | null;
  regon: string | null;
  eori: string | null;
  bank: string | null;
  account_eur: string | null;
  account_pln: string | null;
  email: string | null;
  terms: string[] | null;
  telegram_bot: string | null;
  legacy_login_domain: string | null;
};

export function companyFromRow(row: CompanyRow): Company {
  const str = (v: string | null | undefined) => (v ?? '').trim();
  const name = str(row.name) || UNCONFIGURED_COMPANY.name;
  return {
    name,
    shortName: str(row.short_name) || name,
    address: str(row.address),
    city: str(row.city),
    nip: str(row.nip),
    regon: str(row.regon),
    eori: str(row.eori),
    bank: str(row.bank),
    accountEur: str(row.account_eur),
    accountPln: str(row.account_pln),
    email: str(row.email),
    terms: (row.terms ?? []).map((t) => t.trim()).filter(Boolean),
    telegramBot: str(row.telegram_bot).replace(/^@/, '') || null,
    legacyLoginDomain: str(row.legacy_login_domain).replace(/^@/, '') || null,
  };
}

export type CompanyFormResult = { ok: true; row: CompanyRow } | { ok: false; error: string };

/** Разбор формы /settings. Условия — по одному на строку. */
export function parseCompanyForm(get: (key: string) => string | null): CompanyFormResult {
  const v = (k: string) => (get(k) ?? '').trim();
  const name = v('name');
  if (!name) return { ok: false, error: 'Укажите название компании' };

  const email = v('email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Неверный e-mail' };
  }

  const bot = v('telegram_bot').replace(/^@/, '');
  if (bot && !/^[A-Za-z0-9_]{5,32}$/.test(bot)) {
    return { ok: false, error: 'Имя Telegram-бота: латиница, цифры и _, 5–32 символа' };
  }

  const terms = v('terms')
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean);

  return {
    ok: true,
    row: {
      name,
      short_name: v('short_name') || null,
      address: v('address') || null,
      city: v('city') || null,
      nip: v('nip') || null,
      regon: v('regon') || null,
      eori: v('eori') || null,
      bank: v('bank') || null,
      account_eur: v('account_eur') || null,
      account_pln: v('account_pln') || null,
      email: email || null,
      terms,
      telegram_bot: bot || null,
      legacy_login_domain: v('legacy_login_domain').replace(/^@/, '') || null,
    },
  };
}
