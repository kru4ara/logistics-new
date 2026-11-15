-- 027: фактуры через разные сервисы (Fakturowo.pl, Fakturownia, …).
--
-- trips.invoice_provider   — какой сервис выставил фактуру: 'fakturowo' | 'fakturownia'
-- trips.invoice_external_id — id фактуры в этом сервисе (вместо fakturownia_id из 026)
-- trips.ksef_status        — теперь наше состояние, одинаковое для всех сервисов:
--   pending (ждёт отправки в KSeF в программе фактур) / processing / ok / error /
--   notConnected / notApplicable; null — не отправлялась.
--
-- Порядок: сразу после деплоя; код без колонок не открывает карточку заказа.

begin;

alter table public.trips
  add column if not exists invoice_provider text,
  add column if not exists invoice_external_id text;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'trips' and column_name = 'fakturownia_id') then
    update public.trips
       set invoice_provider = 'fakturownia',
           invoice_external_id = fakturownia_id::text,
           ksef_status = case
             when ksef_status in ('ok', 'demo_ok') then 'ok'
             when ksef_status in ('processing', 'demo_processing', 'offline') then 'processing'
             when ksef_status = 'not_connected' then 'notConnected'
             when ksef_status = 'not_applicable' then 'notApplicable'
             when ksef_status is null or ksef_status = '' then null
             else 'error'
           end
     where fakturownia_id is not null;
    drop index if exists public.trips_fakturownia_id_key;
    alter table public.trips drop column fakturownia_id;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'trips_invoice_provider_check') then
    alter table public.trips add constraint trips_invoice_provider_check
      check (invoice_provider is null or invoice_provider in ('fakturowo', 'fakturownia'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trips_invoice_ref_pair') then
    alter table public.trips add constraint trips_invoice_ref_pair
      check ((invoice_provider is null) = (invoice_external_id is null));
  end if;
end $$;

create unique index if not exists trips_invoice_external_key
  on public.trips (invoice_provider, invoice_external_id)
  where invoice_external_id is not null;

commit;
