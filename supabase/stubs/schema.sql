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
