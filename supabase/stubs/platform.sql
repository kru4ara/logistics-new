-- ============================================================
-- То, что в Supabase создаёт сама платформа, а в чистом Postgres нет.
-- Применяется в CI после prepare.sql и до миграций.
-- Схема приложения — в supabase/migrations/00000000_000_baseline.sql.
-- ============================================================

-- Учётные записи Supabase Auth (каркас: только колонки, которые читает код).
create table if not exists auth.users (
  id uuid primary key,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Хранилище (каркас).
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text
);
alter table storage.objects enable row level security;

-- Ручные бэкап-таблицы, которые есть только на проде (в базовую схему
-- не входят). Тест проверяет, что миграция 011 закрывает их от anon и
-- authenticated, поэтому создаём их здесь — колонки, нужные тесту.
create table if not exists public.bak_trips_20261031 (
  id uuid primary key,
  trip_number text,
  revenue_eur numeric
);
create table if not exists public.bak_forwarding_orders_20261031 (
  id uuid primary key,
  order_number integer
);
-- Как Supabase по умолчанию: новые таблицы доступны anon/authenticated,
-- пока их явно не закрыли.
grant all on public.bak_trips_20261031, public.bak_forwarding_orders_20261031 to anon, authenticated;

-- Права по умолчанию, как в Supabase: всё новое в public сразу доступно
-- anon / authenticated / service_role. Базовая схема и миграции обязаны
-- закрывать лишнее явно — CI проверяет это в таких же условиях, как прод.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
