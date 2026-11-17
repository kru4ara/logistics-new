import { describe, it, expect } from 'vitest';
import { parsePkoStatement, compactAccount } from '../bank/pko-rules';
import { classifyTx, defaultOverhead, matchPurchases, matchTrips, numberTokens, sameParty, type PurchaseRef, type TripRef } from '../bank/match-rules';

// Вымышленная выписка в формате PKO (строки, как их отдаёт lib/bank/pdf-text.ts).
const OWN_PLN = '11102032060000000000000001';
const OWN_EUR = '22102032060000000000000002';
const statement = (rows: string[], closing = '1 000,00') => [
  'www.pkobp.pl, infolinia: 800 302 302 brak opłat dla numerów krajowych na terenie kraju',
  'WYCIĄG za okres 01.10.2026 - 31.10.2026',
  'Nr: 6/2026   Data: 31.10.2026   strona 1/2',
  'Nr rachunku/karty: 22 1020 3206 0000 0000 0000 0002',
  'Waluta rachunku: EUR   ODPOWIEDZIALNOŚCIĄ',
  'Saldo poprzednie   1 000,00',
  'Data operacji   Identyfikator operacji   TYP OPERACJI   Kwota operacji   Saldo',
  'Data waluty   Opis operacji',
  ...rows,
  `Saldo końcowe   ${closing}`,
  'Niniejszy dokument jest wydrukiem z systemu informatycznego PKO Banku Polskiego SA i nie wymaga podpisu ani pieczęci.',
];

describe('выписка PKO', () => {
  const rows = [
    '02.10.2026   SR26SN1   UZN.KWOTĄ OTRZ. PRZEL. ZAGRANICZNY   9 200,00   10 200,00',
    '02.10.2026   Zlec.: LLC ALFA LOGISTIC MINSK BY Rach. zlec.: BY88PJCB30120770911000000978 Benef.:',
    'TESTCO SP. Z O.O. PL tyt.: FOR FORWARDING, CONTR.907, 902,',
    '903,6776.',
    'Kwota oryg.: 9 200,00 EUR Kl. koszt.: OUR',
    'Saldo do przeniesienia   10 200,00',
    'WYCIĄG za okres 01.10.2026 - 31.10.2026',
    'Nr: 6/2026   Data: 31.10.2026   strona 2/2',
    'Nr rachunku/karty: 22 1020 3206 0000 0000 0000 0002',
    'Saldo z przeniesienia   10 200,00',
    'Data operacji   Identyfikator operacji   TYP OPERACJI   Kwota operacji   Saldo',
    '05.10.2026   SR26IP2   OBC.KWOTĄ WYSYŁ. PRZEL.ZAGRANICZNY   -2 400,00   7 800,00',
    '05.10.2026   Benef.: AGENT SK Rach. benef.: SK8509000000005222470713 tyt.: 202601886,',
    '202601923',
    'Kwota oryg.: 2 400,00 EUR Kl. koszt.: SHA Kwota prow.: 1,10 EUR',
    '06.10.2026   6779GP1   OBCIĄŻENIE OPERACJĄ SKARBOWĄ   -6 800,00   1 000,00',
    '06.10.2026   FX19314110 EUR/PLN 4,34620 11 1020 3206 0000 0000 0000 0001 TESTCO',
    'SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ Ref. wł. zlec.: CAL79334769',
  ];

  it('счёт, период, операции через перенос страницы; поля описания', () => {
    const r = parsePkoStatement(statement(rows));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = r.statement;
    expect([s.account, s.currency, s.periodFrom, s.periodTo, s.number]).toEqual([OWN_EUR, 'EUR', '2026-10-01', '2026-10-31', '6/2026']);
    expect(s.transactions.map((t) => t.amount)).toEqual([9200, -2400, -6800]);
    const [inc, out, fx] = s.transactions;
    expect(inc).toMatchObject({ bookingDate: '2026-10-02', valueDate: '2026-10-02', counterparty: 'LLC ALFA LOGISTIC MINSK BY', counterpartyAccount: 'BY88PJCB30120770911000000978' });
    expect(inc.title).toBe('FOR FORWARDING, CONTR.907, 902, 903,6776.');
    expect(out).toMatchObject({ counterparty: 'AGENT SK', counterpartyAccount: 'SK8509000000005222470713', title: '202601886, 202601923' });
    expect(fx.counterpartyAccount).toBe(OWN_PLN);
  });

  it('остатки не сходятся — выписка прочитана не целиком', () => {
    expect(parsePkoStatement(statement(rows, '999,00'))).toEqual({ ok: false, error: 'balance' });
    expect(parsePkoStatement(['какой-то текст'])).toEqual({ ok: false, error: 'notPko' });
  });

  it('польский IBAN — 26 цифр', () => {
    expect(compactAccount('PL 25 1020 3206 0000 8302 0215 5406')).toBe('25102032060000830202155406');
    expect(compactAccount('SK85 0900 0000 0052 2247 0713')).toBe('SK8509000000005222470713');
  });
});

const tx = (o: Partial<Parameters<typeof classifyTx>[0]>) => ({
  type: 'PRZELEW WYCHODZĄCY', amount: -100, counterparty: 'X', counterpartyAccount: null, title: null, description: '', ...o,
});

describe('вид операции', () => {
  const own = [OWN_PLN, OWN_EUR];
  it('свои счета, комиссии, налоги, наличные, карта, клиенты, поставщики', () => {
    expect(classifyTx(tx({ counterpartyAccount: OWN_PLN, amount: 130, type: 'PRZELEW PRZYCHODZĄCY' }), own)).toBe('internal');
    expect(classifyTx(tx({ type: 'UZNANIE OPERACJĄ SKARBOWĄ', amount: 8579.2 }), own)).toBe('internal');
    expect(classifyTx(tx({ type: 'OBC. PROW. OD WYSYŁ. PRZEL. ZAGR', amount: -1.1 }), own)).toBe('fee');
    expect(classifyTx(tx({ type: 'PRZELEW ZEWNĘTRZNY NZUS' }), own)).toBe('tax');
    expect(classifyTx(tx({ type: 'PRZELEW US VAT', title: 'P 79 26M09 PIT-4' }), own)).toBe('tax');
    expect(classifyTx(tx({ type: 'WYPŁATA W BANKOMACIE', amount: -8000 }), own)).toBe('cash');
    expect(classifyTx(tx({ title: 'ZWROT KOSZTOW', amount: -10000 }), own)).toBe('cash');
    expect(classifyTx(tx({ type: 'ZAKUP PRZY UŻYCIU KARTY', counterparty: 'STACJA PALIW HORBOW' }), own)).toBe('card');
    expect(classifyTx(tx({ type: 'UZN.KWOTĄ OTRZ. PRZEL. ZAGRANICZNY', amount: 9200, counterparty: 'LLC ALFA' }), own)).toBe('client');
    expect(classifyTx(tx({ title: 'FAKTURA VAT NR FA/1639/2026' }), own)).toBe('supplier');
    expect(classifyTx(tx({ title: 'COR766823', counterparty: 'COMPENSA TU S.A.' }), own)).toBe('supplier');
  });

  it('категория общих расходов по умолчанию', () => {
    expect(defaultOverhead('fee', tx({}))).toBe('bank_fees');
    expect(defaultOverhead('tax', tx({}))).toBe('taxes');
    expect(defaultOverhead('card', tx({ counterparty: 'STACJA PALIW HORBOW' }))).toBe('fuel');
    expect(defaultOverhead('other_out', tx({ counterparty: 'MINISTERSTWO FINANSOW', title: '/OPT/X///// PAYU' }))).toBe('tolls');
    expect(defaultOverhead('other_out', tx({ title: 'ZALEGŁE WYNAGRODZENIE 8 MIESIĘCY' }))).toBe('salary');
    expect(defaultOverhead('supplier', tx({ counterparty: 'PZU SA', title: 'POLISA NR 1' }))).toBe('insurance');
    expect(defaultOverhead('supplier', tx({ title: 'FAKTURA 1' }))).toBeNull();
  });
});

const inv = (id: string, o: Partial<PurchaseRef> = {}): PurchaseRef => ({
  id, number: 'FA/1639/2026', sellerName: 'BIURO RACHUNKOWE TEST', gross: 1389.9, currency: 'PLN', issueDate: '2026-09-03', ...o,
});
const out = (o: Record<string, unknown> = {}) => ({ ...tx({ amount: -1389.9, title: 'FAKTURA VAT NR FA/1639/2026', counterparty: 'BIURO RACHUNKOWE TEST' }), bookingDate: '2026-09-07', currency: 'PLN', ...o });

describe('платёж → счета подрядчиков', () => {
  it('номер в назначении и сумма — точно; номер без суммы — вероятно', () => {
    expect(matchPurchases(out(), 'supplier', [inv('a'), inv('b', { number: 'FA/1/2026' })])).toEqual({ ids: ['a'], exact: true });
    expect(matchPurchases(out({ amount: -1000 }), 'supplier', [inv('a')])).toEqual({ ids: ['a'], exact: false });
  });

  it('несколько номеров в одном платеже (агентство)', () => {
    const r = matchPurchases(
      out({ amount: -2400, currency: 'EUR', title: '202601886, 202601923', counterparty: 'AGENT SK' }),
      'supplier',
      [inv('x', { number: '202601886', gross: 1800, currency: 'EUR' }), inv('y', { number: '202601923', gross: 600, currency: 'EUR' })],
    );
    expect(r).toEqual({ ids: ['x', 'y'], exact: true });
  });

  it('урезанный номер в назначении: «1601/SR/2026» → «FS 1601/SR/2026»', () => {
    expect(matchPurchases(out({ amount: -550, title: '1601/SR/2026', counterparty: 'SERWIS' }), 'supplier', [inv('w', { number: 'FS 1601/SR/2026', gross: 550 })])).toEqual({ ids: ['w'], exact: true });
  });

  it('без номера: сумма + похожий продавец; посредник — если сумма одна; карта — ±5 дней', () => {
    expect(matchPurchases(out({ title: 'PRZELEW' }), 'supplier', [inv('a', { number: 'X/1' })])).toEqual({ ids: ['a'], exact: false });
    // PayPro платит за Trans.eu: название другое, сумма одна такая
    expect(matchPurchases(out({ title: '/OPT/X/////P24', counterparty: 'PAYPRO S.A.', amount: -651.9 }), 'supplier', [inv('t', { number: 'FT/1', sellerName: 'Trans.eu Group', gross: 651.9, issueDate: '2026-09-01' })])).toEqual({ ids: ['t'], exact: false });
    // две одинаковые суммы — не угадываем
    expect(matchPurchases(out({ title: '/OPT', counterparty: 'PAYPRO' }), 'supplier', [inv('a', { number: 'A/1', sellerName: 'Q' }), inv('b', { number: 'B/1', sellerName: 'W' })])).toBeNull();
    const card = { ...out({ title: null, counterparty: 'STACJA PALIW', amount: -280.39 }), type: 'ZAKUP PRZY UŻYCIU KARTY', bookingDate: '2026-09-10' };
    expect(matchPurchases(card, 'card', [inv('p', { number: 'F 5935K2', sellerName: 'PAJERO', gross: 280.39, issueDate: '2026-09-09' })])).toEqual({ ids: ['p'], exact: false });
    expect(matchPurchases(card, 'card', [inv('p', { number: 'F 5935K2', gross: 280.39, issueDate: '2026-08-20' })])).toBeNull();
  });

  it('другая валюта и приход — не сопоставляем', () => {
    expect(matchPurchases(out({ currency: 'EUR' }), 'supplier', [inv('a')])).toBeNull();
    expect(matchPurchases(out({ amount: 1389.9 }), 'supplier', [inv('a')])).toBeNull();
  });
});

const trip = (id: string, o: Partial<TripRef> = {}): TripRef => ({
  id, tripNumber: id, requestNumber: null, invoiceNumber: null, amount: 3000, currency: 'EUR', clientName: 'LLC ALFA LOGISTIC', paid: false, ...o,
});
const inc = (o: Record<string, unknown> = {}) => ({ ...tx({ amount: 9200, counterparty: 'LLC ALFA LOGISTIC MINSK', title: 'FOR FORWARDING, CONTR.907, 902, 903,6776.' }), currency: 'EUR', ...o });

describe('приход → заказы', () => {
  it('номера заказов в назначении (один платёж — несколько заказов)', () => {
    expect(numberTokens('CONTR.907, 902, 903,6776.')).toEqual(['907', '902', '903', '6776']);
    // даты, годы и номер KSeF — не номера заказов
    expect(numberTokens('CONTR.885 DD 27.07.26, 886DD 04.08.26, FAKTURA 38/08/2026 KSEF 7011162939-20260901-38816D800001-19 2026')).toEqual(['885', '886']);
    const r = matchTrips(inc(), [trip('907', { amount: 3000 }), trip('902', { amount: 2000 }), trip('903', { amount: 2000 }), trip('6776', { amount: 2200 }), trip('111')]);
    expect(r).toEqual({ ids: ['907', '902', '903', '6776'], exact: true });
  });

  it('номер счёта клиенту в назначении; сумма не сходится — вероятно', () => {
    const r = matchTrips(inc({ amount: 1650, title: '38/08/2026, NR KSEF: 7011162939-20260901-38816D800001-19', counterparty: 'NCK' }), [trip('a', { invoiceNumber: '38/08/2026', amount: 1650 }), trip('b', { invoiceNumber: '3/08/2026' })]);
    expect(r).toEqual({ ids: ['a'], exact: true });
    expect(matchTrips(inc({ amount: 1000, title: 'FAKTURA 38/08/2026' }), [trip('a', { invoiceNumber: '38/08/2026', amount: 1650 })])).toEqual({ ids: ['a'], exact: false });
  });

  it('без номеров — один неоплаченный заказ клиента с той же суммой', () => {
    expect(matchTrips(inc({ amount: 3000, title: 'PAYMENT' }), [trip('a'), trip('b', { amount: 2000 })])).toEqual({ ids: ['a'], exact: false });
    expect(matchTrips(inc({ amount: 3000, title: 'PAYMENT' }), [trip('a'), trip('b')])).toBeNull();
    expect(sameParty('LLC ALFA LOGISTIC MINSK', 'Alfa Logistic LLC')).toBe(true);
    expect(sameParty('SP. Z O.O.', 'SPÓŁKA Z O.O.')).toBe(false);
  });
});
