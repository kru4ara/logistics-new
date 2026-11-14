import { describe, it, expect, vi } from 'vitest';
import {
  renderTerms,
  companyFromRow,
  parseCompanyForm,
  LEGACY_COMPANY,
  UNCONFIGURED_COMPANY,
  type CompanyRow,
} from '../company-rules';

// Прежняя функция из lib/company.ts (до переноса реквизитов в базу) —
// эталон: заявки после переноса должны выходить слово в слово такими же.
function legacyGetTerms(paymentDays: number, docType: 'originals' | 'scans' = 'originals'): string[] {
  const docText = docType === 'scans'
    ? 'skanów CMR (potwierdzonych podpisem, pieczątką odbiorcy) przesłanych drogą mailową'
    : 'oryginała CMR (potwierdzonego podpisem, pieczątką odbiorcy)';

  return [
    `1) Termin płatności ${paymentDays} dni po dostarczeniu ${docText} oraz prawidłowo wystawionej faktury, vat = 0% (Część transportu drogowego, stawka podatku vat wynosi 0%, zgodnie z przepisami art. 28b, ust.1 w odniesieniu do art 83 ust 1pkt 23 ustawy o podatku od towarów i usług, trasa stanowi czesc transportu miedzynarodowego w rozumieniu przepisów rozporzadzenia ministra finansów z dn 28 listopada 2008 par 9 ust 1 pkt 1 i 2.)`,
    `2) W celu terminowej płatności, przed wysłaniem dokumentów, należy przesłać skan faktury i CMR na raibuilding.pl@gmail.com`,
    `3) Ustalony normatywny postój na terenie UE-24 godziny, BY/RUS-48 godzin. Opłata ponadnormatywnego postoju wynosi 100 EUR za każde rozpoczęte dobę.`,
    `4) Faktura powinna być wystawiona w miesiącu wykonania usługi!!! Data zakończenia dostawy/usługi = dacie rozładunku.`,
    `5) Za opóźnienie na załadunek powyżej godziny przewoźnik może być obciążany mandatem 30 EUR za każde rozpoczętą godzinę opóźnienia, ale nie więcej 300 EUR za dobę.`,
    `6) ZAKAZ POKAZYWANIA NASZEGO ZLECENIA NA MIEJSCU ZAŁADUNKU i ROZŁADUNKU!!!`,
    `7) Kierowca ma pilnować sprawność towaru pod czas załadunku i rozładunku. Po załadunku wysłać zdjęcie załadowanego towaru i dokumentów!!!`,
    `8) Przeładunek towaru w tranzycie jest zabroniony! Mandat 1000 euro.`,
    `9) W przypadku braku podstawienia pojazdu w ustalonym terminie, przewoźnik ponosi karę umowną w wysokości 500 EUR.`,
    `10) Przewoźnik zobowiązany jest do stałego kontaktu telefonicznego z kierowcą i przekazywania statusów na żądanie zleceniodawcy.`,
  ];
}


describe('renderTerms', () => {
  it('условия RAIBUILDING совпадают со старым getTerms слово в слово (оригиналы и сканы)', () => {
    for (const days of [14, 30, 60]) {
      expect(renderTerms(LEGACY_COMPANY, days, 'originals')).toEqual(legacyGetTerms(days, 'originals'));
      expect(renderTerms(LEGACY_COMPANY, days, 'scans')).toEqual(legacyGetTerms(days, 'scans'));
    }
  });

  it('подстановки работают в любом пункте и по нескольку раз', () => {
    const out = renderTerms({ email: 'a@b.pl', terms: ['{payment_days}/{payment_days} {email}', 'без подстановок'] }, 7);
    expect(out).toEqual(['7/7 a@b.pl', 'без подстановок']);
  });
});

const row = (over: Partial<CompanyRow> = {}): CompanyRow => ({
  name: 'ACME SP. Z O.O.', short_name: null, address: null, city: null, nip: null, regon: null,
  eori: null, bank: null, account_eur: null, account_pln: null, email: null, terms: null,
  telegram_bot: null, legacy_login_domain: null, ...over,
});

describe('companyFromRow', () => {
  it('короткое название по умолчанию — полное', () => {
    expect(companyFromRow(row()).shortName).toBe('ACME SP. Z O.O.');
  });

  it('@ в имени бота и домене убирается, пустые — null', () => {
    const c = companyFromRow(row({ telegram_bot: '@acme_bot', legacy_login_domain: '@acme.local' }));
    expect(c.telegramBot).toBe('acme_bot');
    expect(c.legacyLoginDomain).toBe('acme.local');
    expect(companyFromRow(row({ telegram_bot: '  ' })).telegramBot).toBeNull();
  });

  it('пустое название — «не настроена», а не чужое', () => {
    expect(companyFromRow(row({ name: '' })).name).toBe(UNCONFIGURED_COMPANY.name);
  });

  it('новая компания не наследует реквизиты RAIBUILDING', () => {
    const c = companyFromRow(row());
    expect(c.accountEur).toBe('');
    expect(c.terms).toEqual([]);
    expect(c.telegramBot).toBeNull();
    expect(c.legacyLoginDomain).toBeNull();
    expect(JSON.stringify(UNCONFIGURED_COMPANY)).not.toMatch(/raibuilding/i);
  });
});

describe('parseCompanyForm', () => {
  const form = (o: Record<string, string>) => (k: string) => o[k] ?? null;

  it('без названия — ошибка', () => {
    expect(parseCompanyForm(form({ name: '  ' }))).toEqual({ ok: false, error: 'Укажите название компании' });
  });

  it('неверный e-mail и имя бота — ошибки', () => {
    expect(parseCompanyForm(form({ name: 'A', email: 'нет' })).ok).toBe(false);
    expect(parseCompanyForm(form({ name: 'A', telegram_bot: 'bad bot!' })).ok).toBe(false);
  });

  it('условия — по строкам, пустые строки отбрасываются', () => {
    const r = parseCompanyForm(form({ name: 'A', terms: '1) раз\r\n\n  2) два  \n' }));
    expect(r.ok && r.row.terms).toEqual(['1) раз', '2) два']);
  });

  it('туда и обратно: форма → строка → компания', () => {
    const r = parseCompanyForm(form({ name: 'A', email: 'x@y.pl', telegram_bot: '@a_bot_1', account_eur: 'PL1' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const c = companyFromRow(r.row);
    expect(c).toMatchObject({ name: 'A', email: 'x@y.pl', telegramBot: 'a_bot_1', accountEur: 'PL1' });
  });
});

// --- getCompany: какие настройки при каком состоянии базы -----------------
vi.mock('server-only', () => ({}));
let dbResult: { data: unknown; error: { code?: string; message: string } | null } = { data: null, error: null };
vi.mock('../supabase/admin', () => ({
  createClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => dbResult }) }) }),
  }),
}));

describe('getCompany', () => {
  const load = async () => {
    vi.resetModules();
    return (await import('../company')).getCompany();
  };

  it('таблицы нет (миграция 022 не применена) → прежние реквизиты', async () => {
    dbResult = { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.company_settings'" } };
    expect(await load()).toEqual(LEGACY_COMPANY);
  });

  it('строки нет (новая база) → «не настроена», без чужих реквизитов', async () => {
    dbResult = { data: null, error: null };
    expect(await load()).toEqual(UNCONFIGURED_COMPANY);
  });

  it('строка есть → из неё', async () => {
    dbResult = { data: row({ name: 'ACME', account_eur: 'PL9' }), error: null };
    expect(await load()).toMatchObject({ name: 'ACME', accountEur: 'PL9' });
  });

  it('другая ошибка БД → исключение: лучше ошибка, чем заявка с чужими реквизитами', async () => {
    dbResult = { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } };
    await expect(load()).rejects.toThrow(/Настройки компании недоступны/);
  });
});
