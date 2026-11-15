-- 026: фактуры через Fakturownia (она же отправляет их в KSeF).
--
-- clients.tax_id / street / post_code / city / country — реквизиты покупателя
--   для фактуры (NIP, VAT UE или иной номер; country — ISO 3166, две буквы).
-- trips.fakturownia_id — id фактуры в Fakturownia (одна фактура на заказ;
--   повторную не даст и сама Fakturownia: oid = id заказа, oid_unique).
-- trips.ksef_status — gov_status из Fakturownia: processing / ok / send_error /
--   server_error / offline / not_connected / demo_* …; ksef_number — номер KSeF;
--   ksef_error — текст ошибки KSeF, если отправка не прошла.
--
-- Порядок: в любой момент; код без колонок показывает ошибку загрузки заказа.

begin;

alter table public.clients
  add column if not exists tax_id text,
  add column if not exists street text,
  add column if not exists post_code text,
  add column if not exists city text,
  add column if not exists country text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_country_iso2') then
    alter table public.clients
      add constraint clients_country_iso2 check (country is null or country ~ '^[A-Z]{2}$');
  end if;
end $$;

alter table public.trips
  add column if not exists fakturownia_id bigint,
  add column if not exists ksef_status text,
  add column if not exists ksef_number text,
  add column if not exists ksef_error text;

create unique index if not exists trips_fakturownia_id_key on public.trips (fakturownia_id)
  where fakturownia_id is not null;

commit;
