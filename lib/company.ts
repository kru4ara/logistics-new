// ============================================================
// Реквизиты компании (для DOCX заявок)
// ============================================================
export const COMPANY = {
  name: 'RAIBUILDING SP. Z O.O.',
  address: 'PL21-345 WOLA OSOWIŃSKA, ul. PARKOWA 12',
  nip: '7011162939',
  regon: '526314665',
  bank: 'PKO Bank Polski S.A. - SWIFT BPKOPLPW',
  eori: 'PL701116293900000',
  accountEur: 'PL25 1020 3206 0000 8302 0215 5406',
  accountPln: 'PL82 1020 3206 0000 8402 0215 5398',
  city: 'WOLA OSOWIŃSKA',
  email: 'raibuilding.pl@gmail.com',
};

// Ссылки на картинки (из Supabase Storage)
export const STAMP_URL =
  process.env.COMPANY_STAMP_URL ||
  'https://smodijsjwcvsscfgloh.supabase.co/storage/v1/object/public/documents/assets/stamp.png';

export const LOGO_URL =
  process.env.COMPANY_LOGO_URL ||
  'https://smodijsjwcvsscfgloh.supabase.co/storage/v1/object/public/documents/assets/logo.png';

// ============================================================
// Условия перевозки (8 пунктов)
// Срок оплаты подставляется динамически
// ============================================================
export function getTerms(paymentDays: number): string[] {
  return [
    `1) Termin płatności ${paymentDays} dni po dostarczeniu oryginała CMR (potwierdzonego podpisem, pieczątką odbiorcy) oraz prawidłowo wystawionej faktury, vat = 0% (Część transportu drogowego, stawka podatku vat wynosi 0%, zgodnie z przepisami art. 28b, ust.1 w odniesieniu do art 83 ust 1pkt 23 ustawy o podatku od towarów i usług, trasa stanowi czesc transportu miedzynarodowego w rozumieniu przepisów rozporzadzenia ministra finansów z dn 28 listopada 2008 par 9 ust 1 pkt 1 i 2.)`,
    `2) W celu terminowej płatności, przed wysłaniem dokumentów, należy przesłać skan faktury i CMR na ${COMPANY.email}`,
    `3) Ustalony normatywny postój na terenie UE-24 godziny, BY/RUS-48 godzin. Opłata ponadnormatywnego postoju wynosi 100 EUR za każde dobę.`,
    `4) Faktura powinna być wystawiona w miesiącu wykonania usługi!!! Data zakończenia dostawy/usługi = dacie rozładunku.`,
    `5) Za opóźnienie na załadunek powyżej godziny przewoźnik może być obciążany mandatem 30 EUR za każde godzinę opóźnienia ale nie więcej 300 EUR za dobę.`,
    `6) ZAKAZ POKAZYWANIA NASZEGO ZLECENIA NA MIEJSCU ZAŁADUNKU i ROZŁADUNKU!!!`,
    `7) Kierowca ma pilnować sprawność towaru pod czas załadunku i rozładunku. Po załadunku wysłac zdjęcie załadowanego towaru i dokumentów!!!`,
    `8) Przeładunek towaru w tranzycie jest zabroniony! Mandat 1000 euro`,
  ];
}
