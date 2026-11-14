-- ============================================================
-- 022: настройки компании — реквизиты из кода в базу
-- ============================================================
--
-- Одна строка (id = 1): реквизиты для заявок, условия перевозки,
-- Telegram-бот, домен старых логинов. Правка — страница /settings
-- (право settings.edit, только офис). Чтение — lib/company.ts.
--
-- Заполнение: ТОЛЬКО в базе, где уже есть заказы — то есть в прежней
-- единственной базе (RAIBUILDING), её реквизитами из lib/company-rules.ts
-- (LEGACY_COMPANY). Новая база клиента остаётся без строки — до первого
-- сохранения настроек код показывает «Компания не настроена», а не чужие
-- реквизиты и банковские счета.
--
-- Порядок: в любой момент. Без таблицы код использует прежние реквизиты.
--
-- Доступ: офис читает и пишет через RLS (is_office()); anon — ничего.
-- Приложение читает настройки admin-клиентом (страница входа — до входа).
-- ============================================================

begin;

create table if not exists public.company_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null,
  short_name text,
  address text,
  city text,
  nip text,
  regon text,
  eori text,
  bank text,
  account_eur text,
  account_pln text,
  email text,
  terms text[] not null default '{}',
  telegram_bot text,
  legacy_login_domain text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.company_settings is
  'Настройки компании (одна строка, id = 1): реквизиты для заявок, условия перевозки, Telegram-бот. Правка — /settings.';
comment on column public.company_settings.terms is
  'Условия перевозки в заявке. Подстановки: {payment_days}, {documents}, {email}.';

alter table public.company_settings enable row level security;

revoke all on table public.company_settings from public, anon, authenticated;
grant select, update on table public.company_settings to authenticated;
grant select, insert, update, delete on table public.company_settings to service_role;

drop policy if exists company_settings_office_select on public.company_settings;
create policy company_settings_office_select on public.company_settings
  for select to authenticated using (public.is_office());

drop policy if exists company_settings_office_update on public.company_settings;
create policy company_settings_office_update on public.company_settings
  for update to authenticated using (public.is_office()) with check (public.is_office());

do $do$
begin
  if not exists (select 1 from public.company_settings)
     and exists (select 1 from public.trips) then
      insert into public.company_settings
        (id, name, short_name, address, city, nip, regon, eori, bank,
         account_eur, account_pln, email, terms, telegram_bot, legacy_login_domain)
      values
        (1, $v$RAIBUILDING SP. Z O.O.$v$, $v$RAIBUILDING$v$, $v$PL21-345 WOLA OSOWIŃSKA, ul. PARKOWA 12$v$, $v$WOLA OSOWIŃSKA$v$,
         $v$7011162939$v$, $v$526314665$v$, $v$PL701116293900000$v$, $v$PKO Bank Polski S.A. - SWIFT BPKOPLPW$v$,
         $v$PL25 1020 3206 0000 8302 0215 5406$v$, $v$PL82 1020 3206 0000 8402 0215 5398$v$, $v$raibuilding.pl@gmail.com$v$,
      array[$v$1) Termin płatności {payment_days} dni po dostarczeniu {documents} oraz prawidłowo wystawionej faktury, vat = 0% (Część transportu drogowego, stawka podatku vat wynosi 0%, zgodnie z przepisami art. 28b, ust.1 w odniesieniu do art 83 ust 1pkt 23 ustawy o podatku od towarów i usług, trasa stanowi czesc transportu miedzynarodowego w rozumieniu przepisów rozporzadzenia ministra finansów z dn 28 listopada 2008 par 9 ust 1 pkt 1 i 2.)$v$,
      $v$2) W celu terminowej płatności, przed wysłaniem dokumentów, należy przesłać skan faktury i CMR na {email}$v$,
      $v$3) Ustalony normatywny postój na terenie UE-24 godziny, BY/RUS-48 godzin. Opłata ponadnormatywnego postoju wynosi 100 EUR za każde rozpoczęte dobę.$v$,
      $v$4) Faktura powinna być wystawiona w miesiącu wykonania usługi!!! Data zakończenia dostawy/usługi = dacie rozładunku.$v$,
      $v$5) Za opóźnienie na załadunek powyżej godziny przewoźnik może być obciążany mandatem 30 EUR za każde rozpoczętą godzinę opóźnienia, ale nie więcej 300 EUR za dobę.$v$,
      $v$6) ZAKAZ POKAZYWANIA NASZEGO ZLECENIA NA MIEJSCU ZAŁADUNKU i ROZŁADUNKU!!!$v$,
      $v$7) Kierowca ma pilnować sprawność towaru pod czas załadunku i rozładunku. Po załadunku wysłać zdjęcie załadowanego towaru i dokumentów!!!$v$,
      $v$8) Przeładunek towaru w tranzycie jest zabroniony! Mandat 1000 euro.$v$,
      $v$9) W przypadku braku podstawienia pojazdu w ustalonym terminie, przewoźnik ponosi karę umowną w wysokości 500 EUR.$v$,
      $v$10) Przewoźnik zobowiązany jest do stałego kontaktu telefonicznego z kierowcą i przekazywania statusów na żądanie zleceniodawcy.$v$]::text[],
         $v$raibuilding_bot$v$, $v$raibuilding.local$v$);
  end if;
end;
$do$;

commit;
