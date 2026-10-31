-- ============================================================
-- Упрощённая схема для проверки миграций в CI
-- ============================================================
-- Это НЕ миграция и НЕ реальная схема проекта. Это минимальный
-- каркас таблиц и колонок, на которые ссылаются наши RLS-политики.
-- Нужен, чтобы прогнать supabase/migrations/*.sql на чистом Postgres
-- и убедиться, что SQL синтаксически корректен, политики создаются,
-- а поведение соответствует ожиданиям.
--
-- Реальная схема создана через Supabase UI и в git не отражается.
-- Когда появится базовая миграция с полной схемой, этот каркас можно
-- удалить и заменить её.
--
-- ВНИМАНИЕ: колонки, не нужные политикам, опущены. Если политика
-- начнёт ссылаться на новую колонку, CI это поймает (ошибка SQL).
-- ============================================================

create table public.profiles (
  id uuid primary key,
  role text,
  driver_id uuid,
  full_name text
);

create table public.users (
  id uuid primary key,
  login text,
  email text
);

create table public.drivers (
  id uuid primary key,
  first_name text,
  last_name text,
  email text,
  onboarded_at timestamptz
);

create table public.clients (
  id uuid primary key,
  name text,
  contact_person text,
  email text,
  phone text
);

create table public.contractors (
  id uuid primary key,
  name text
);

create table public.trips (
  id uuid primary key,
  trip_number text,
  driver_id uuid,
  client_id uuid,
  status text,
  start_date date,
  end_date date
);

create table public.trip_segments (
  id uuid primary key,
  trip_id uuid,
  driver_id uuid,
  contractor_id uuid,
  truck_id uuid,
  trailer_id uuid,
  position int,
  executor_type text,
  date_to date,
  from_city text,
  from_country text,
  to_city text,
  to_country text,
  to_company text,
  to_postal_code text,
  to_address text
);

create table public.trip_expenses (
  id uuid primary key,
  trip_id uuid,
  segment_id uuid,
  category text,
  amount_eur numeric,
  original_amount numeric,
  currency text,
  liters numeric,
  description text,
  expense_date date,
  paid_by_driver boolean
);

create table public.trip_cargo (
  id uuid primary key,
  trip_id uuid,
  client_id uuid,
  position int,
  label text,
  cargo_type text,
  weight_kg numeric,
  pallets int,
  freight_amount numeric,
  freight_currency text
);

create table public.trip_segment_cargo (
  id uuid primary key,
  segment_id uuid,
  cargo_id uuid,
  cargo_type text,
  label text,
  weight_kg numeric
);

create table public.trip_documents (
  id uuid primary key,
  trip_id uuid,
  document_type text,
  file_path text,
  original_name text,
  uploaded_at timestamptz default now()
);

create table public.documents (
  id uuid primary key,
  entity_type text,
  entity_id uuid,
  file_path text,
  trip_number text,
  uploaded_at timestamptz default now()
);

create table public.driver_transactions (
  id uuid primary key,
  driver_id uuid,
  type text,
  amount_eur numeric,
  original_amount numeric,
  currency text,
  notes text,
  date date,
  created_at timestamptz default now()
);

create table public.trucks (
  id uuid primary key,
  registration_number text,
  logisat_device_id text,
  logisat_enabled boolean,
  type text,
  tachograph_last_download timestamptz
);

create table public.rates (
  rate_date date primary key,
  pln_to_eur numeric,
  byn_to_eur numeric
);

create table public.reminders (
  id uuid primary key,
  title text,
  category text,
  due_date date,
  entity_type text,
  entity_id uuid,
  status text,
  amount numeric
);

-- Таблицы, доступные только офису
create table public.locations (id uuid primary key, name text);
create table public.fixed_costs (id uuid primary key, name text, amount numeric);
create table public.audit_log (id uuid primary key, action text, created_at timestamptz default now());
create table public.forwarding_orders (id uuid primary key, reference text);
create table public.forwarding_contractors (id uuid primary key, name text);
create table public.forwarding_expenses (id uuid primary key, amount numeric);
create table public.forwarding_points (id uuid primary key, name text);

-- Права, как в Supabase по умолчанию
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon, authenticated, service_role;
grant insert, update, delete on all tables in schema public to authenticated, service_role;

-- ============================================================
-- Дополнения по РЕАЛЬНОЙ схеме (снято с боевой базы 31.10.2026).
-- Нужны миграциям 20261031_*: единая модель заказа и перенос
-- экспедирований. Каркас выше — урезанный; ниже — недостающие
-- колонки и таблицы, на которые ссылаются эти миграции.
-- ============================================================

-- Заказ (рейс + экспедирование)
alter table public.trips add column if not exists truck_id uuid;
alter table public.trips add column if not exists trailer_id uuid;
alter table public.trips add column if not exists revenue_eur numeric;
alter table public.trips add column if not exists created_at timestamptz default now();
alter table public.trips add column if not exists client_request_number text;
alter table public.trips add column if not exists client_request_date date;
alter table public.trips add column if not exists profit_mode text default 'trip';
alter table public.trips add column if not exists is_forwarding boolean default false;
alter table public.trips add column if not exists load_date date;
alter table public.trips add column if not exists unload_date date;
alter table public.trips add column if not exists costs_closed boolean default false;
alter table public.trips add column if not exists source_forwarding_id uuid;

-- Участок маршрута
alter table public.trip_segments add column if not exists date_from date;
alter table public.trip_segments add column if not exists stops jsonb default '[]'::jsonb;
alter table public.trip_segments add column if not exists price numeric;
alter table public.trip_segments add column if not exists currency text default 'EUR'::text;
alter table public.trip_segments add column if not exists notes text;
alter table public.trip_segments add column if not exists created_at timestamptz default now();
alter table public.trip_segments add column if not exists contractor_truck_number text;
alter table public.trip_segments add column if not exists contractor_driver_name text;
alter table public.trip_segments add column if not exists contractor_payment_days integer default 30;
alter table public.trip_segments add column if not exists contractor_transport_type text;
alter table public.trip_segments add column if not exists contractor_transport_temperature text;

-- Расход заказа
alter table public.trip_expenses add column if not exists currency text default 'EUR'::text;
alter table public.trip_expenses add column if not exists created_at timestamptz default now();

-- Справочник точек
alter table public.locations add column if not exists type text;
alter table public.locations add column if not exists country text;
alter table public.locations add column if not exists company_name text;
alter table public.locations add column if not exists postal_code text;
alter table public.locations add column if not exists city text;
alter table public.locations add column if not exists address text;
alter table public.locations add column if not exists default_loading_number text;

-- Общие затраты
alter table public.fixed_costs add column if not exists month_key text;
alter table public.fixed_costs add column if not exists category text;
alter table public.fixed_costs add column if not exists amount_eur numeric;
alter table public.fixed_costs add column if not exists currency text;
alter table public.fixed_costs add column if not exists cost_type text;
alter table public.fixed_costs add column if not exists expense_date date;
alter table public.fixed_costs add column if not exists is_capex boolean default false;

-- Старое экспедирование (источник переноса)
alter table public.forwarding_orders add column if not exists order_number integer;
alter table public.forwarding_orders add column if not exists client_id uuid;
alter table public.forwarding_orders add column if not exists client_price_eur numeric default 0;
alter table public.forwarding_orders add column if not exists load_date date;
alter table public.forwarding_orders add column if not exists unload_date date;
alter table public.forwarding_orders add column if not exists status text default 'planned'::text;
alter table public.forwarding_orders add column if not exists created_at timestamptz default now();
alter table public.forwarding_orders add column if not exists client_request_number text;
alter table public.forwarding_orders add column if not exists client_request_date date;
alter table public.forwarding_orders add column if not exists transport_type text;
alter table public.forwarding_orders add column if not exists transport_temperature text;

alter table public.forwarding_contractors add column if not exists forwarding_id uuid;
alter table public.forwarding_contractors add column if not exists contractor_id uuid;
alter table public.forwarding_contractors add column if not exists price_eur numeric default 0;
alter table public.forwarding_contractors add column if not exists position integer default 1;
alter table public.forwarding_contractors add column if not exists created_at timestamptz default now();
alter table public.forwarding_contractors add column if not exists truck_number text;
alter table public.forwarding_contractors add column if not exists driver_name text;
alter table public.forwarding_contractors add column if not exists notes text;
alter table public.forwarding_contractors add column if not exists payment_days integer default 30;
alter table public.forwarding_contractors add column if not exists currency text default 'EUR'::text;

alter table public.forwarding_expenses add column if not exists forwarding_id uuid;
alter table public.forwarding_expenses add column if not exists category text;
alter table public.forwarding_expenses add column if not exists amount_eur numeric default 0;
alter table public.forwarding_expenses add column if not exists currency text default 'EUR'::text;
alter table public.forwarding_expenses add column if not exists description text;
alter table public.forwarding_expenses add column if not exists expense_date date;
alter table public.forwarding_expenses add column if not exists created_at timestamptz default now();

alter table public.forwarding_points add column if not exists forwarding_id uuid;
alter table public.forwarding_points add column if not exists type text;
alter table public.forwarding_points add column if not exists sequence integer default 1;
alter table public.forwarding_points add column if not exists location_id uuid;
alter table public.forwarding_points add column if not exists date date;
alter table public.forwarding_points add column if not exists loading_number text;
alter table public.forwarding_points add column if not exists notes text;

-- Оставшиеся колонки реальной схемы, на которые ссылаются миграции 002/003
alter table public.locations add column if not exists name text;
alter table public.fixed_costs add column if not exists amount_pln numeric;
alter table public.forwarding_contractors add column if not exists original_price numeric default 0;
alter table public.forwarding_expenses add column if not exists original_amount numeric default 0;
