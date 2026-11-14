-- ============================================================
-- 000: БАЗОВАЯ СХЕМА — схема public боевой базы на 14.11.2026
-- ============================================================
--
-- Источник: scripts/export-schema.sql на проде (проект smodijsjiwcvsscfgloh),
-- после миграций 001–019. Собрано scripts/build-baseline.py.
--
-- Зачем: ранние таблицы создавались руками в SQL Editor, и из миграций
-- 001–019 новую базу не собрать. Эта миграция создаёт всё с нуля —
-- для базы нового клиента и для CI (вместо заглушки supabase/stubs/schema.sql).
--
-- Идемпотентна: на существующей базе ничего не меняет (if not exists,
-- drop/create для политик и триггеров с теми же определениями).
--
-- Отличия от прода на момент выгрузки (исправлены миграцией 020):
--   * exec_sql / exec_sql_json / merge_* — EXECUTE только service_role;
--   * публичные политики storage.objects для бакета documents не создаются.
-- Таблицы bak_* (ручные бэкапы прода) сюда не входят.
--
-- Расширения pg_stat_statements и supabase_vault Supabase ставит сам.
-- ============================================================

begin;

set check_function_bodies = off;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists extensions;
create extension if not exists "uuid-ossp" with schema extensions;

create sequence if not exists public.trips_number_seq;

CREATE OR REPLACE FUNCTION public.current_driver_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.driver_id from public.profiles p where p.id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.current_manager_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.manager_id from public.profiles p where p.id = auth.uid();
$function$
;

CREATE OR REPLACE FUNCTION public.derive_profit_mode(p_trip_id uuid)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  v_has_us boolean;       -- есть сегмент с нашим транспортом (любое назначение)
  v_has_us_full boolean;  -- наш транспорт назначен полностью (машина + водитель)
  v_has_contractor boolean;
begin
  select
    exists (select 1 from public.trip_segments s
             where s.trip_id = p_trip_id and s.executor_type = 'us'),
    exists (select 1 from public.trip_segments s
             where s.trip_id = p_trip_id and s.executor_type = 'us'
               and s.truck_id is not null and s.driver_id is not null),
    exists (select 1 from public.trip_segments s
             where s.trip_id = p_trip_id and s.executor_type = 'contractor'
               and s.contractor_id is not null)
    into v_has_us, v_has_us_full, v_has_contractor;

-- Смешанный заказ (подрядчик + наша авто) - это рейс, а не экспедиция.
  -- Наличие сегмента 'us' без назначенной машины не должно переводить
  -- заказ в экспедирование.
  if v_has_us and (v_has_us_full or v_has_contractor) then return 'trip'; end if;
  if v_has_us_full then return 'trip'; end if;
  if v_has_contractor then return 'forwarding'; end if;
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.driver_has_client(p_client_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select exists (
    select 1 from public.trips t
    where t.client_id = p_client_id
      and public.driver_owns_trip(t.id)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.driver_owns_segment(p_segment_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select exists (
    select 1 from public.trip_segments s
    where s.id = p_segment_id
      and s.driver_id = public.current_driver_id()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.driver_owns_segment_cargo(p_segment_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select exists (
    select 1
    from public.trip_segments s
    where s.id = p_segment_id
      and (
        s.driver_id = public.current_driver_id()
        or public.driver_owns_trip(s.trip_id)
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.driver_owns_trip(p_trip_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id
      and t.driver_id = public.current_driver_id()
  )
  or exists (
    select 1 from public.trip_segments s
    where s.trip_id = p_trip_id
      and s.driver_id = public.current_driver_id()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.driver_uses_contractor(p_contractor_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select exists (
    select 1
    from public.trip_segments s
    where s.contractor_id = p_contractor_id
      and (
        s.driver_id = public.current_driver_id()
        or public.driver_owns_trip(s.trip_id)
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.exec_sql(query text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  execute query;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.exec_sql_json(query text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; rows_out jsonb := '[]'::jsonb; row_out jsonb;
begin
  for r in execute query loop
    row_out := jsonb_build_object();
    for row_out in
      select jsonb_object_agg(key, value) from jsonb_each_text(to_jsonb(r))
    loop
      rows_out := rows_out || jsonb_build_array(row_out);
    end loop;
  end loop;
  return rows_out;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.fixed_costs_by_month(p_year integer)
 RETURNS TABLE(month_key text, amount numeric)
 LANGUAGE plpgsql
 STABLE
AS $function$
begin
  return query
    select fc.month_key,
           sum(fc.amount_eur) as amount
      from public.fixed_costs fc
     where fc.month_key is not null
       and fc.month_key like p_year::text || '-%'
       and fc.is_capex is not true
       and fc.amount_eur is not null
       and fc.amount_eur <> 0
     group by fc.month_key
     order by fc.month_key;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_app_meta_data->>'role', 'driver'),
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(btrim(p.role)) = 'manager'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_office()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(btrim(p.role)) in ('office', 'admin')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.lookup_login_email(p_login text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare v_email text; v_login text; begin if p_login is null or btrim(p_login) = '' then return null; end if; v_login := btrim(p_login); begin select au.email into v_email from auth.users au where lower(au.email) = lower(v_login) limit 1; exception when others then v_email := null; end; if v_email is not null then return v_email; end if; select m.email into v_email from public.managers m where lower(btrim(m.full_name)) = lower(v_login) and m.email is not null limit 1; if v_email is not null then return v_email; end if; select m.email into v_email from public.managers m where lower(m.email) = lower(v_login) limit 1; if v_email is not null then return v_email; end if; select d.email into v_email from public.drivers d where lower(btrim(d.last_name)) = lower(v_login) and d.email is not null limit 1; if v_email is not null then return v_email; end if; select d.email into v_email from public.drivers d where lower(d.email) = lower(v_login) limit 1; if v_email is not null then return v_email; end if; select u.email into v_email from public.users u where lower(btrim(u.login)) = lower(v_login) and u.email is not null limit 1; if v_email is not null then return v_email; end if; begin select au.email into v_email from auth.users au where split_part(lower(au.email), '@', 1) = lower(v_login) and (select count(*) from auth.users au2 where split_part(lower(au2.email), '@', 1) = lower(v_login)) = 1 limit 1; exception when others then v_email := null; end; return v_email; end; $function$
;

CREATE OR REPLACE FUNCTION public.manager_has_client(p_client_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select exists (
    select 1 from public.trips t
    where t.client_id = p_client_id
      and public.manager_owns_trip(t.id)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.manager_owns_segment_cargo(p_segment_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select exists (
    select 1 from public.trip_segments s
    where s.id = p_segment_id
      and public.manager_owns_trip(s.trip_id)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.manager_owns_trip(p_trip_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id
      and (
        t.manager_id is null
        or t.manager_id = public.current_manager_id()
      )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.manager_uses_contractor(p_contractor_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select exists (
    select 1 from public.trip_segments s
    where s.contractor_id = p_contractor_id
      and public.manager_owns_trip(s.trip_id)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.merge_clients(source_id uuid, target_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  if source_id = target_id then
    raise exception 'Нельзя объединить клиента с самим собой';
  end if;

-- Проверяем, что оба существуют
  if not exists (select 1 from clients where id = source_id) then
    raise exception 'Клиент-источник не найден';
  end if;
  if not exists (select 1 from clients where id = target_id) then
    raise exception 'Клиент-цель не найден';
  end if;

-- Переносим ссылки
  update trips set client_id = target_id where client_id = source_id;
  update trip_cargo set client_id = target_id where client_id = source_id;
  update forwarding_orders set client_id = target_id where client_id = source_id;

-- Удаляем дубликат
  delete from clients where id = source_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.merge_contractors(source_id uuid, target_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF source_id = target_id THEN
    RAISE EXCEPTION 'source_id и target_id совпадают';
  END IF;

IF NOT EXISTS (SELECT 1 FROM contractors WHERE id = source_id) THEN
    RAISE EXCEPTION 'Подрядчик-источник % не найден', source_id;
  END IF;

IF NOT EXISTS (SELECT 1 FROM contractors WHERE id = target_id) THEN
    RAISE EXCEPTION 'Подрядчик-цель % не найден', target_id;
  END IF;

-- Участки рейсов: переносим на target
  UPDATE trip_segments
    SET contractor_id = target_id
    WHERE contractor_id = source_id;

-- Заявки экспедирования: переносим на target
  UPDATE forwarding_contractors
    SET contractor_id = target_id
    WHERE contractor_id = source_id;

-- ВАЖНО: trip_expenses.subcontractor_id НЕ трогаем —
  -- это висячая колонка от удалённой trip_subcontractors,
  -- не ссылается на contractors (проверено: FK нет, UUID-ов в contractors нет).

-- Удаляем дубликат
  DELETE FROM contractors WHERE id = source_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.renumber_all_trips()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  r record;
  v_counter_trip integer := 0;
  v_counter_fwd  integer := 0;
  v_mode text;
  v_eligible boolean;
begin
  update public.trips set trip_number = '~0' where trip_number is not null;

for r in
    select t.id, t.start_date, t.end_date, t.load_date, t.unload_date, t.created_at, t.profit_mode,
           exists (select 1 from public.trip_segments s where s.trip_id = t.id
                     and s.executor_type = 'us') as has_us,
           exists (select 1 from public.trip_segments s where s.trip_id = t.id
                     and s.executor_type = 'us' and s.truck_id is not null and s.driver_id is not null) as has_us_full,
           exists (select 1 from public.trip_segments s where s.trip_id = t.id
                     and s.executor_type = 'contractor' and s.contractor_id is not null) as has_contractor
      from public.trips t
     order by t.end_date asc nulls last,
              t.created_at asc, t.id asc
  loop
    v_mode := case when r.profit_mode = 'forwarding' then 'forwarding' else 'trip' end;

if v_mode = 'forwarding' then
      v_eligible := r.has_contractor;
    else
      v_eligible := r.has_us_full or (r.has_us and r.has_contractor);
    end if;

if not v_eligible then
      update public.trips set trip_number = null where id = r.id;
      continue;
    end if;

if v_mode = 'forwarding' then
      v_counter_fwd := v_counter_fwd + 1;
      update public.trips set trip_number = v_counter_fwd::text || 'Е' where id = r.id;
    else
      v_counter_trip := v_counter_trip + 1;
      update public.trips set trip_number = v_counter_trip::text where id = r.id;
    end if;
  end loop;

update public.trip_counter set last_number = v_counter_trip where id = 1;
  update public.trip_counter set last_number = v_counter_fwd  where id = 2;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
    if cmd.schema_name is not null
       and cmd.schema_name = 'public'
       and cmd.schema_name not in ('pg_catalog','information_schema')
       and cmd.schema_name not like 'pg_toast%'
       and cmd.schema_name not like 'pg_temp%'
    then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);

-- Бэкап-таблицы: дополнительно снимаем публичные гранты.
        -- Имя таблицы берём из object_identity (schema.table).
        if cmd.object_identity like '%.bak\_%' then
          execute format('revoke all on table %s from anon, authenticated', cmd.object_identity);
          raise log 'rls_auto_enable: locked backup table %', cmd.object_identity;
        else
          raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
        end if;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (not in public schema)', cmd.object_identity;
    end if;
  end loop;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_trip_from_segment()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare v_mode text;
begin
  v_mode := public.derive_profit_mode(NEW.trip_id);
  if v_mode is not null then
    update public.trips set profit_mode = v_mode
     where id = NEW.trip_id and profit_mode is distinct from v_mode;
  end if;
  if v_mode = 'forwarding' then
    if NEW.executor_type = 'contractor' then
      update public.trips
         set load_date  = coalesce(public.trips.load_date, NEW.date_from),
             unload_date = coalesce(public.trips.unload_date, NEW.date_to)
       where id = NEW.trip_id;
    end if;
    return NEW;
  end if;
  if v_mode = 'trip' then
    if NEW.executor_type = 'us' then
      update public.trips
         set truck_id   = coalesce(NEW.truck_id, truck_id),
             trailer_id = coalesce(NEW.trailer_id, trailer_id),
             driver_id  = coalesce(NEW.driver_id, driver_id)
       where id = NEW.trip_id;
    end if;
    return NEW;
  end if;
  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_profiles_manager_needs_card()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if lower(btrim(new.role)) = 'manager' and new.manager_id is null then
    new.role := 'office';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_segment_renumber()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  perform public.renumber_all_trips();
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_trip_renumber()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  perform public.renumber_all_trips();
  return null;
end;
$function$
;

create table if not exists public.audit_log (
  id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now() not null,
  user_role text not null,
  user_id uuid,
  user_name text not null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  changes jsonb,
  summary text
);

create table if not exists public.clients (
  id uuid default gen_random_uuid() not null,
  name text not null,
  contact_person text,
  phone text,
  email text,
  created_at timestamp with time zone default now()
);

create table if not exists public.contractors (
  id uuid default gen_random_uuid() not null,
  name text not null,
  phone text,
  notes text,
  created_at timestamp with time zone default now(),
  full_name text,
  address text,
  tax_id text,
  contact_person text,
  email text,
  country text
);

create table if not exists public.documents (
  id uuid default gen_random_uuid() not null,
  document_type text,
  file_path text,
  expiry_date date,
  uploaded_at timestamp with time zone default now(),
  entity_type text,
  entity_id uuid
);

create table if not exists public.driver_telegram_links (
  token_hash text not null,
  driver_id uuid not null,
  created_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone not null,
  used_at timestamp with time zone
);

create table if not exists public.driver_transactions (
  id uuid default gen_random_uuid() not null,
  driver_id uuid not null,
  trip_id uuid,
  expense_id uuid,
  type text not null,
  amount_eur numeric not null,
  original_amount numeric,
  currency text default 'EUR'::text,
  date date not null,
  notes text,
  created_at timestamp with time zone default now()
);

create table if not exists public.drivers (
  id uuid default gen_random_uuid() not null,
  first_name text not null,
  last_name text not null,
  passport_expiry date,
  visa_expiry date,
  license_expiry date,
  tachograph_card_expiry date,
  created_at timestamp with time zone default now(),
  passport_number text,
  passport_issued_by text,
  visa_type text,
  license_number text,
  license_categories text,
  tachograph_card_number text,
  code_95_expiry date,
  adr_expiry date,
  date_of_birth date,
  address text,
  user_id uuid,
  password_hash text,
  telegram_chat_id text,
  onboarded_at timestamp with time zone,
  driver_card_last_download date,
  phone_pl text,
  phone_by text,
  passport_series text,
  passport_issued_date date,
  email text
);

create table if not exists public.fixed_costs (
  id uuid default gen_random_uuid() not null,
  month_key text not null,
  category text,
  amount_pln numeric(10,2),
  amount_eur numeric(10,2),
  currency text default 'EUR'::text,
  cost_type text,
  original_amount numeric,
  expense_date date,
  is_capex boolean default false,
  capex_rule text
);

create table if not exists public.forwarding_contractors (
  id uuid default gen_random_uuid() not null,
  forwarding_id uuid not null,
  contractor_id uuid,
  price_eur numeric default 0 not null,
  original_price numeric default 0 not null,
  currency text default 'EUR'::text not null,
  "position" integer default 1 not null,
  created_at timestamp with time zone default now(),
  truck_number text,
  driver_name text,
  notes text,
  payment_days integer default 30
);

create table if not exists public.forwarding_expenses (
  id uuid default gen_random_uuid() not null,
  forwarding_id uuid not null,
  category text not null,
  amount_eur numeric default 0 not null,
  original_amount numeric default 0 not null,
  currency text default 'EUR'::text not null,
  description text,
  expense_date date,
  created_at timestamp with time zone default now()
);

create table if not exists public.forwarding_orders (
  id uuid default gen_random_uuid() not null,
  order_number integer,
  client_id uuid,
  client_price_eur numeric default 0,
  original_currency text default 'EUR'::text,
  original_client_price numeric default 0,
  load_date date,
  unload_date date,
  cargo_description text,
  status text default 'planned'::text,
  notes text,
  created_at timestamp with time zone default now(),
  client_request_number text,
  client_request_date date,
  transport_type text,
  cargo_type text,
  cargo_quantity text,
  customs_loading text,
  customs_unloading text,
  loading_reference text,
  transport_temperature text
);

create table if not exists public.forwarding_points (
  id uuid default gen_random_uuid() not null,
  forwarding_id uuid not null,
  type text not null,
  sequence integer default 1 not null,
  location_id uuid,
  date date,
  loading_number text,
  notes text,
  created_at timestamp with time zone default now()
);

create table if not exists public.locations (
  id uuid default gen_random_uuid() not null,
  name text not null,
  type text default 'both'::text,
  country text,
  company_name text,
  postal_code text,
  city text,
  address text,
  default_loading_number text,
  created_at timestamp with time zone default now(),
  contact_person text,
  sort_order integer default 0,
  contact_phone text,
  gps_lat double precision,
  gps_lng double precision
);

create table if not exists public.managers (
  id uuid default gen_random_uuid() not null,
  full_name text not null,
  phone text,
  email text,
  telegram_chat_id text,
  user_id uuid,
  notes text,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  password_updated_at timestamp with time zone
);

create table if not exists public.profiles (
  id uuid not null,
  role text not null,
  driver_id uuid,
  full_name text,
  created_at timestamp with time zone default now(),
  manager_id uuid
);

create table if not exists public.rates (
  id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now() not null,
  rate_date date,
  pln_to_eur numeric,
  byn_to_eur numeric
);

create table if not exists public.reminders (
  id uuid default gen_random_uuid() not null,
  title text not null,
  description text,
  category text,
  entity_type text,
  entity_id uuid,
  due_date date not null,
  remind_days integer default 30,
  amount numeric(10,2),
  is_recurring boolean default false,
  status text default 'active'::text,
  last_notified_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  last_notified_days integer
);

create table if not exists public.trip_cargo (
  id uuid default gen_random_uuid() not null,
  trip_id uuid not null,
  "position" integer default 1 not null,
  label text,
  cargo_type text,
  weight_kg numeric,
  client_id uuid,
  notes text,
  created_at timestamp with time zone default now(),
  from_country text,
  from_city text,
  from_company text,
  from_address text,
  from_postal_code text,
  to_country text,
  to_city text,
  to_company text,
  to_address text,
  to_postal_code text,
  pallets integer,
  customs_place text,
  freight_amount numeric(12,2),
  freight_currency text default 'EUR'::text,
  customs_country text,
  customs_city text,
  customs_postal_code text,
  customs_address text,
  customs_lat double precision,
  customs_lng double precision
);

create table if not exists public.trip_counter (
  id integer default 1 not null,
  last_number integer default 0 not null
);

create table if not exists public.trip_documents (
  id uuid default gen_random_uuid() not null,
  uploaded_at timestamp with time zone default now() not null,
  trip_id uuid,
  document_type text,
  file_path text,
  original_name text,
  billing numeric
);

create table if not exists public.trip_expenses (
  id uuid default gen_random_uuid() not null,
  trip_id uuid,
  category text,
  amount_eur numeric(10,2),
  description text,
  expense_date date,
  created_at timestamp with time zone default now(),
  currency text default 'EUR'::text,
  original_amount numeric,
  liters numeric,
  segment_id uuid,
  paid_by_driver boolean default false
);

create table if not exists public.trip_segment_cargo (
  segment_id uuid not null,
  cargo_id uuid not null
);

create table if not exists public.trip_segments (
  id uuid default gen_random_uuid() not null,
  trip_id uuid not null,
  "position" integer default 1 not null,
  executor_type text not null,
  contractor_id uuid,
  truck_id uuid,
  driver_id uuid,
  date_from date,
  date_to date,
  from_country text,
  from_city text,
  from_company text,
  from_address text,
  from_postal_code text,
  to_country text,
  to_city text,
  to_company text,
  to_address text,
  to_postal_code text,
  stops jsonb default '[]'::jsonb,
  notes text,
  created_at timestamp with time zone default now(),
  price numeric,
  currency text default 'EUR'::text,
  contractor_truck_number text,
  contractor_driver_name text,
  contractor_payment_days integer default 30,
  contractor_transport_type text,
  contractor_transport_temperature text,
  contractor_payment_document_type text default 'originals'::text,
  contractor_transport_height text,
  trailer_id uuid
);

create table if not exists public.trips (
  id uuid default gen_random_uuid() not null,
  client_id uuid,
  driver_id uuid,
  truck_id uuid,
  start_date timestamp without time zone,
  end_date timestamp without time zone,
  status text,
  revenue_eur numeric(10,2),
  start_lat numeric,
  start_lng numeric,
  loading_address text,
  actual_km numeric,
  actual_liters numeric,
  start_fuel_level numeric,
  warehouse_name text,
  trip_number text,
  client_request_number text,
  client_request_date date,
  trailer_id uuid,
  end_lat numeric,
  end_lng numeric,
  start_odometer numeric,
  end_odometer numeric,
  end_fuel_level numeric,
  logisat_synced_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  profit_mode text default 'trip'::text not null,
  is_forwarding boolean default false not null,
  load_date date,
  unload_date date,
  source_forwarding_id uuid,
  manager_id uuid
);

create table if not exists public.trucks (
  id uuid default gen_random_uuid() not null,
  registration_number text not null,
  type text,
  insurance_expiry date,
  border_insurance_expiry date,
  tech_inspection_expiry date,
  created_at timestamp with time zone default now(),
  device_id text,
  truck_insurance_expiry date,
  fuel_card_number text,
  ownership_docs_expiry date,
  trailer_number text,
  tachograph_legalization_expiry date,
  logisat_device_id text,
  logisat_enabled boolean default false,
  brand text,
  model text,
  year integer,
  vin text,
  to_expiry date,
  tachograph_calibration_expiry date,
  customs_certificate_expiry date,
  tachograph_last_download date
);

create table if not exists public.users (
  id uuid default gen_random_uuid() not null,
  login text,
  role text default 'admin'::text,
  password_hash text,
  email text
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'audit_log_pkey' and conrelid = 'public.audit_log'::regclass) then
    alter table public.audit_log add constraint audit_log_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'clients_pkey' and conrelid = 'public.clients'::regclass) then
    alter table public.clients add constraint clients_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contractors_pkey' and conrelid = 'public.contractors'::regclass) then
    alter table public.contractors add constraint contractors_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'documents_pkey' and conrelid = 'public.documents'::regclass) then
    alter table public.documents add constraint documents_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'driver_telegram_links_pkey' and conrelid = 'public.driver_telegram_links'::regclass) then
    alter table public.driver_telegram_links add constraint driver_telegram_links_pkey PRIMARY KEY (token_hash);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'driver_transactions_pkey' and conrelid = 'public.driver_transactions'::regclass) then
    alter table public.driver_transactions add constraint driver_transactions_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'drivers_pkey' and conrelid = 'public.drivers'::regclass) then
    alter table public.drivers add constraint drivers_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fixed_costs_pkey' and conrelid = 'public.fixed_costs'::regclass) then
    alter table public.fixed_costs add constraint fixed_costs_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'forwarding_contractors_pkey' and conrelid = 'public.forwarding_contractors'::regclass) then
    alter table public.forwarding_contractors add constraint forwarding_contractors_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'forwarding_expenses_pkey' and conrelid = 'public.forwarding_expenses'::regclass) then
    alter table public.forwarding_expenses add constraint forwarding_expenses_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'forwarding_orders_pkey' and conrelid = 'public.forwarding_orders'::regclass) then
    alter table public.forwarding_orders add constraint forwarding_orders_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'forwarding_points_pkey' and conrelid = 'public.forwarding_points'::regclass) then
    alter table public.forwarding_points add constraint forwarding_points_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'forwarding_points_type_check' and conrelid = 'public.forwarding_points'::regclass) then
    alter table public.forwarding_points add constraint forwarding_points_type_check CHECK ((type = ANY (ARRAY['loading'::text, 'unloading'::text])));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'locations_pkey' and conrelid = 'public.locations'::regclass) then
    alter table public.locations add constraint locations_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'locations_type_check' and conrelid = 'public.locations'::regclass) then
    alter table public.locations add constraint locations_type_check CHECK ((type = ANY (ARRAY['loading'::text, 'unloading'::text, 'both'::text, 'customs'::text])));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'managers_pkey' and conrelid = 'public.managers'::regclass) then
    alter table public.managers add constraint managers_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_pkey' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_role_check CHECK (((role IS NULL) OR (role = ANY (ARRAY['admin'::text, 'office'::text, 'manager'::text, 'driver'::text]))));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rates_pkey' and conrelid = 'public.rates'::regclass) then
    alter table public.rates add constraint rates_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rates_rate_date_key' and conrelid = 'public.rates'::regclass) then
    alter table public.rates add constraint rates_rate_date_key UNIQUE (rate_date);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reminders_category_check' and conrelid = 'public.reminders'::regclass) then
    alter table public.reminders add constraint reminders_category_check CHECK ((category = ANY (ARRAY['insurance'::text, 'inspection'::text, 'driver_doc'::text, 'payment_to_contractor'::text, 'accounting'::text])));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reminders_entity_type_check' and conrelid = 'public.reminders'::regclass) then
    alter table public.reminders add constraint reminders_entity_type_check CHECK ((entity_type = ANY (ARRAY['driver'::text, 'truck'::text, 'contractor'::text, 'general'::text])));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reminders_pkey' and conrelid = 'public.reminders'::regclass) then
    alter table public.reminders add constraint reminders_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trip_cargo_pkey' and conrelid = 'public.trip_cargo'::regclass) then
    alter table public.trip_cargo add constraint trip_cargo_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trip_counter_pkey' and conrelid = 'public.trip_counter'::regclass) then
    alter table public.trip_counter add constraint trip_counter_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trip_documents_pkey' and conrelid = 'public.trip_documents'::regclass) then
    alter table public.trip_documents add constraint trip_documents_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trip_expenses_category_check' and conrelid = 'public.trip_expenses'::regclass) then
    alter table public.trip_expenses add constraint trip_expenses_category_check CHECK ((category = ANY (ARRAY['fuel'::text, 'epi'::text, 'etoll'::text, 'border'::text, 'salary'::text, 'contractor'::text, 'permit'::text, 'tlc'::text, 'waiting'::text, 'repair'::text, 'parking'::text, 'disinfection'::text, 'ex1'::text, 'otkat'::text, 'gps_seal'::text, 'other'::text])));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trip_expenses_pkey' and conrelid = 'public.trip_expenses'::regclass) then
    alter table public.trip_expenses add constraint trip_expenses_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trip_segment_cargo_pkey' and conrelid = 'public.trip_segment_cargo'::regclass) then
    alter table public.trip_segment_cargo add constraint trip_segment_cargo_pkey PRIMARY KEY (segment_id, cargo_id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trip_segments_pkey' and conrelid = 'public.trip_segments'::regclass) then
    alter table public.trip_segments add constraint trip_segments_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trips_pkey' and conrelid = 'public.trips'::regclass) then
    alter table public.trips add constraint trips_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trips_profit_mode_check' and conrelid = 'public.trips'::regclass) then
    alter table public.trips add constraint trips_profit_mode_check CHECK ((profit_mode = ANY (ARRAY['trip'::text, 'forwarding'::text])));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trips_status_check' and conrelid = 'public.trips'::regclass) then
    alter table public.trips add constraint trips_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'active'::text, 'completed'::text, 'invoiced'::text, 'paid'::text])));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trucks_pkey' and conrelid = 'public.trucks'::regclass) then
    alter table public.trucks add constraint trucks_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trucks_type_check' and conrelid = 'public.trucks'::regclass) then
    alter table public.trucks add constraint trucks_type_check CHECK ((type = ANY (ARRAY['tractor'::text, 'trailer'::text])));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_login_key' and conrelid = 'public.users'::regclass) then
    alter table public.users add constraint users_login_key UNIQUE (login);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_pkey' and conrelid = 'public.users'::regclass) then
    alter table public.users add constraint users_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'driver_telegram_links_driver_id_fkey' and conrelid = 'public.driver_telegram_links'::regclass) then
    alter table public.driver_telegram_links add constraint driver_telegram_links_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'driver_transactions_driver_id_fkey' and conrelid = 'public.driver_transactions'::regclass) then
    alter table public.driver_transactions add constraint driver_transactions_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'driver_transactions_expense_id_fkey' and conrelid = 'public.driver_transactions'::regclass) then
    alter table public.driver_transactions add constraint driver_transactions_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES trip_expenses(id) ON DELETE SET NULL;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'driver_transactions_trip_id_fkey' and conrelid = 'public.driver_transactions'::regclass) then
    alter table public.driver_transactions add constraint driver_transactions_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'forwarding_contractors_contractor_id_fkey' and conrelid = 'public.forwarding_contractors'::regclass) then
    alter table public.forwarding_contractors add constraint forwarding_contractors_contractor_id_fkey FOREIGN KEY (contractor_id) REFERENCES contractors(id) ON DELETE SET NULL;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'forwarding_contractors_forwarding_id_fkey' and conrelid = 'public.forwarding_contractors'::regclass) then
    alter table public.forwarding_contractors add constraint forwarding_contractors_forwarding_id_fkey FOREIGN KEY (forwarding_id) REFERENCES forwarding_orders(id) ON DELETE CASCADE;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'forwarding_expenses_forwarding_id_fkey' and conrelid = 'public.forwarding_expenses'::regclass) then
    alter table public.forwarding_expenses add constraint forwarding_expenses_forwarding_id_fkey FOREIGN KEY (forwarding_id) REFERENCES forwarding_orders(id) ON DELETE CASCADE;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'forwarding_orders_client_id_fkey' and conrelid = 'public.forwarding_orders'::regclass) then
    alter table public.forwarding_orders add constraint forwarding_orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'forwarding_points_forwarding_id_fkey' and conrelid = 'public.forwarding_points'::regclass) then
    alter table public.forwarding_points add constraint forwarding_points_forwarding_id_fkey FOREIGN KEY (forwarding_id) REFERENCES forwarding_orders(id) ON DELETE CASCADE;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'forwarding_points_location_id_fkey' and conrelid = 'public.forwarding_points'::regclass) then
    alter table public.forwarding_points add constraint forwarding_points_location_id_fkey FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_driver_id_fkey' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_id_fkey' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_manager_id_fkey' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES managers(id) ON DELETE SET NULL;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trip_cargo_client_id_fkey' and conrelid = 'public.trip_cargo'::regclass) then
    alter table public.trip_cargo add constraint trip_cargo_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trip_cargo_trip_id_fkey' and conrelid = 'public.trip_cargo'::regclass) then
    alter table public.trip_cargo add constraint trip_cargo_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trip_expenses_segment_id_fkey' and conrelid = 'public.trip_expenses'::regclass) then
    alter table public.trip_expenses add constraint trip_expenses_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES trip_segments(id) ON DELETE SET NULL;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trip_expenses_trip_id_fkey' and conrelid = 'public.trip_expenses'::regclass) then
    alter table public.trip_expenses add constraint trip_expenses_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trip_segment_cargo_cargo_id_fkey' and conrelid = 'public.trip_segment_cargo'::regclass) then
    alter table public.trip_segment_cargo add constraint trip_segment_cargo_cargo_id_fkey FOREIGN KEY (cargo_id) REFERENCES trip_cargo(id) ON DELETE CASCADE;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trip_segment_cargo_segment_id_fkey' and conrelid = 'public.trip_segment_cargo'::regclass) then
    alter table public.trip_segment_cargo add constraint trip_segment_cargo_segment_id_fkey FOREIGN KEY (segment_id) REFERENCES trip_segments(id) ON DELETE CASCADE;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trip_segments_contractor_id_fkey' and conrelid = 'public.trip_segments'::regclass) then
    alter table public.trip_segments add constraint trip_segments_contractor_id_fkey FOREIGN KEY (contractor_id) REFERENCES contractors(id) ON DELETE SET NULL;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trip_segments_driver_id_fkey' and conrelid = 'public.trip_segments'::regclass) then
    alter table public.trip_segments add constraint trip_segments_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trip_segments_trailer_id_fkey' and conrelid = 'public.trip_segments'::regclass) then
    alter table public.trip_segments add constraint trip_segments_trailer_id_fkey FOREIGN KEY (trailer_id) REFERENCES trucks(id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trip_segments_trip_id_fkey' and conrelid = 'public.trip_segments'::regclass) then
    alter table public.trip_segments add constraint trip_segments_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trip_segments_truck_id_fkey' and conrelid = 'public.trip_segments'::regclass) then
    alter table public.trip_segments add constraint trip_segments_truck_id_fkey FOREIGN KEY (truck_id) REFERENCES trucks(id) ON DELETE SET NULL;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trips_client_id_fkey' and conrelid = 'public.trips'::regclass) then
    alter table public.trips add constraint trips_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trips_driver_id_fkey' and conrelid = 'public.trips'::regclass) then
    alter table public.trips add constraint trips_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trips_manager_id_fkey' and conrelid = 'public.trips'::regclass) then
    alter table public.trips add constraint trips_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES managers(id) ON DELETE SET NULL;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trips_trailer_id_fkey' and conrelid = 'public.trips'::regclass) then
    alter table public.trips add constraint trips_trailer_id_fkey FOREIGN KEY (trailer_id) REFERENCES trucks(id);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'trips_truck_id_fkey' and conrelid = 'public.trips'::regclass) then
    alter table public.trips add constraint trips_truck_id_fkey FOREIGN KEY (truck_id) REFERENCES trucks(id);
  end if;
end $$;

CREATE INDEX IF NOT EXISTS driver_telegram_links_driver_idx ON public.driver_telegram_links USING btree (driver_id);

CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_log USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_log USING btree (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_log USING btree (user_role, user_id);

CREATE INDEX IF NOT EXISTS idx_documents_entity ON public.documents USING btree (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_driver_transactions_driver ON public.driver_transactions USING btree (driver_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_fc_contractor ON public.forwarding_contractors USING btree (contractor_id);

CREATE INDEX IF NOT EXISTS idx_fc_forwarding ON public.forwarding_contractors USING btree (forwarding_id);

CREATE INDEX IF NOT EXISTS idx_forwarding_client ON public.forwarding_orders USING btree (client_id);

CREATE INDEX IF NOT EXISTS idx_forwarding_expenses_category ON public.forwarding_expenses USING btree (category);

CREATE INDEX IF NOT EXISTS idx_forwarding_expenses_forwarding ON public.forwarding_expenses USING btree (forwarding_id);

CREATE INDEX IF NOT EXISTS idx_forwarding_load_date ON public.forwarding_orders USING btree (load_date);

CREATE INDEX IF NOT EXISTS idx_forwarding_status ON public.forwarding_orders USING btree (status);

CREATE INDEX IF NOT EXISTS idx_fp_forwarding ON public.forwarding_points USING btree (forwarding_id);

CREATE INDEX IF NOT EXISTS idx_fp_location ON public.forwarding_points USING btree (location_id);

CREATE INDEX IF NOT EXISTS idx_fp_type_seq ON public.forwarding_points USING btree (forwarding_id, type, sequence);

CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON public.profiles USING btree (manager_id);

CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON public.reminders USING btree (due_date);

CREATE INDEX IF NOT EXISTS idx_reminders_entity ON public.reminders USING btree (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_reminders_notified ON public.reminders USING btree (last_notified_at);

CREATE INDEX IF NOT EXISTS idx_reminders_status ON public.reminders USING btree (status);

CREATE INDEX IF NOT EXISTS idx_trip_cargo_trip ON public.trip_cargo USING btree (trip_id);

CREATE INDEX IF NOT EXISTS idx_trip_documents_trip_id ON public.trip_documents USING btree (trip_id);

CREATE INDEX IF NOT EXISTS idx_trip_expenses_segment ON public.trip_expenses USING btree (segment_id);

CREATE INDEX IF NOT EXISTS idx_trip_expenses_trip_id ON public.trip_expenses USING btree (trip_id);

CREATE INDEX IF NOT EXISTS idx_trip_segment_cargo_cargo ON public.trip_segment_cargo USING btree (cargo_id);

CREATE INDEX IF NOT EXISTS idx_trip_segments_trip ON public.trip_segments USING btree (trip_id);

CREATE INDEX IF NOT EXISTS idx_trips_client_id ON public.trips USING btree (client_id);

CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON public.trips USING btree (driver_id);

CREATE INDEX IF NOT EXISTS idx_trips_logisat_synced ON public.trips USING btree (logisat_synced_at);

CREATE INDEX IF NOT EXISTS idx_trips_manager_id ON public.trips USING btree (manager_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_source_forwarding_id ON public.trips USING btree (source_forwarding_id) WHERE (source_forwarding_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_trips_start_date ON public.trips USING btree (start_date);

CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips USING btree (status);

CREATE INDEX IF NOT EXISTS idx_trips_trailer_id ON public.trips USING btree (trailer_id);

CREATE INDEX IF NOT EXISTS idx_trips_trip_number_num ON public.trips USING btree (((regexp_replace(trip_number, '[^0-9]'::text, ''::text, 'g'::text))::integer)) WHERE (trip_number IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_trips_truck_id ON public.trips USING btree (truck_id);

CREATE INDEX IF NOT EXISTS idx_trucks_logisat_device ON public.trucks USING btree (logisat_device_id);

drop trigger if exists trg_profiles_manager_needs_card on public.profiles;
CREATE TRIGGER trg_profiles_manager_needs_card BEFORE INSERT OR UPDATE OF role, manager_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION trg_profiles_manager_needs_card();

drop trigger if exists trg_segment_renumber on public.trip_segments;
CREATE TRIGGER trg_segment_renumber AFTER INSERT OR DELETE OR UPDATE ON public.trip_segments FOR EACH STATEMENT EXECUTE FUNCTION trg_segment_renumber();

drop trigger if exists trg_sync_trip_from_segment on public.trip_segments;
CREATE TRIGGER trg_sync_trip_from_segment AFTER INSERT OR UPDATE OF truck_id, driver_id, date_from, date_to, executor_type, contractor_id ON public.trip_segments FOR EACH ROW EXECUTE FUNCTION sync_trip_from_segment();

drop trigger if exists trg_trip_renumber on public.trips;
CREATE TRIGGER trg_trip_renumber AFTER INSERT OR DELETE OR UPDATE OF start_date, end_date, load_date, unload_date, profit_mode ON public.trips FOR EACH STATEMENT EXECUTE FUNCTION trg_trip_renumber();

alter table public.audit_log enable row level security;

alter table public.clients enable row level security;

alter table public.contractors enable row level security;

alter table public.documents enable row level security;

alter table public.driver_telegram_links enable row level security;

alter table public.driver_transactions enable row level security;

alter table public.drivers enable row level security;

alter table public.fixed_costs enable row level security;

alter table public.forwarding_contractors enable row level security;

alter table public.forwarding_expenses enable row level security;

alter table public.forwarding_orders enable row level security;

alter table public.forwarding_points enable row level security;

alter table public.locations enable row level security;

alter table public.managers enable row level security;

alter table public.profiles enable row level security;

alter table public.rates enable row level security;

alter table public.reminders enable row level security;

alter table public.trip_cargo enable row level security;

alter table public.trip_counter enable row level security;

alter table public.trip_documents enable row level security;

alter table public.trip_expenses enable row level security;

alter table public.trip_segment_cargo enable row level security;

alter table public.trip_segments enable row level security;

alter table public.trips enable row level security;

alter table public.trucks enable row level security;

alter table public.users enable row level security;

drop policy if exists audit_log_office_select on public.audit_log;
create policy audit_log_office_select on public.audit_log as permissive for select to authenticated using (is_office());

drop policy if exists audit_log_office_write on public.audit_log;
create policy audit_log_office_write on public.audit_log as permissive for all to authenticated using (is_office()) with check (is_office());

drop policy if exists clients_office_write on public.clients;
create policy clients_office_write on public.clients as permissive for all to authenticated using (is_office()) with check (is_office());

drop policy if exists clients_select_own_or_office on public.clients;
create policy clients_select_own_or_office on public.clients as permissive for select to authenticated using ((is_office() OR driver_has_client(id) OR (is_manager() AND manager_has_client(id))));

drop policy if exists contractors_office_write on public.contractors;
create policy contractors_office_write on public.contractors as permissive for all to authenticated using (is_office()) with check (is_office());

drop policy if exists contractors_select_own_or_office on public.contractors;
create policy contractors_select_own_or_office on public.contractors as permissive for select to authenticated using ((is_office() OR driver_uses_contractor(id) OR (is_manager() AND manager_uses_contractor(id))));

drop policy if exists documents_office_write on public.documents;
create policy documents_office_write on public.documents as permissive for all to authenticated using (is_office()) with check (is_office());

drop policy if exists documents_select_own_or_office on public.documents;
create policy documents_select_own_or_office on public.documents as permissive for select to authenticated using ((is_office() OR (EXISTS ( SELECT 1
   FROM drivers d
  WHERE ((d.id = documents.entity_id) AND (d.id = current_driver_id()))))));

drop policy if exists driver_transactions_office_write on public.driver_transactions;
create policy driver_transactions_office_write on public.driver_transactions as permissive for all to authenticated using (is_office()) with check (is_office());

drop policy if exists driver_transactions_select_own_or_office on public.driver_transactions;
create policy driver_transactions_select_own_or_office on public.driver_transactions as permissive for select to authenticated using ((is_office() OR (driver_id = current_driver_id())));

drop policy if exists drivers_office_write on public.drivers;
create policy drivers_office_write on public.drivers as permissive for all to authenticated using (is_office()) with check (is_office());

drop policy if exists drivers_select_own_or_office on public.drivers;
create policy drivers_select_own_or_office on public.drivers as permissive for select to authenticated using ((is_office() OR (id = current_driver_id())));

drop policy if exists fixed_costs_office_select on public.fixed_costs;
create policy fixed_costs_office_select on public.fixed_costs as permissive for select to authenticated using (is_office());

drop policy if exists fixed_costs_office_write on public.fixed_costs;
create policy fixed_costs_office_write on public.fixed_costs as permissive for all to authenticated using (is_office()) with check (is_office());

drop policy if exists forwarding_contractors_office_select on public.forwarding_contractors;
create policy forwarding_contractors_office_select on public.forwarding_contractors as permissive for select to authenticated using (is_office());

drop policy if exists forwarding_contractors_office_write on public.forwarding_contractors;
create policy forwarding_contractors_office_write on public.forwarding_contractors as permissive for all to authenticated using (is_office()) with check (is_office());

drop policy if exists forwarding_expenses_office_select on public.forwarding_expenses;
create policy forwarding_expenses_office_select on public.forwarding_expenses as permissive for select to authenticated using (is_office());

drop policy if exists forwarding_expenses_office_write on public.forwarding_expenses;
create policy forwarding_expenses_office_write on public.forwarding_expenses as permissive for all to authenticated using (is_office()) with check (is_office());

drop policy if exists forwarding_orders_office_select on public.forwarding_orders;
create policy forwarding_orders_office_select on public.forwarding_orders as permissive for select to authenticated using (is_office());

drop policy if exists forwarding_orders_office_write on public.forwarding_orders;
create policy forwarding_orders_office_write on public.forwarding_orders as permissive for all to authenticated using (is_office()) with check (is_office());

drop policy if exists forwarding_points_office_select on public.forwarding_points;
create policy forwarding_points_office_select on public.forwarding_points as permissive for select to authenticated using (is_office());

drop policy if exists forwarding_points_office_write on public.forwarding_points;
create policy forwarding_points_office_write on public.forwarding_points as permissive for all to authenticated using (is_office()) with check (is_office());

drop policy if exists locations_office_select on public.locations;
create policy locations_office_select on public.locations as permissive for select to authenticated using (is_office());

drop policy if exists locations_office_write on public.locations;
create policy locations_office_write on public.locations as permissive for all to authenticated using (is_office()) with check (is_office());

drop policy if exists managers_delete_office on public.managers;
create policy managers_delete_office on public.managers as permissive for delete to authenticated using (is_office());

drop policy if exists managers_insert_office on public.managers;
create policy managers_insert_office on public.managers as permissive for insert to authenticated with check (is_office());

drop policy if exists managers_select_own_or_office on public.managers;
create policy managers_select_own_or_office on public.managers as permissive for select to authenticated using ((is_office() OR (is_manager() AND (id = current_manager_id()))));

drop policy if exists managers_update_office on public.managers;
create policy managers_update_office on public.managers as permissive for update to authenticated using (is_office()) with check (is_office());

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles as permissive for select to authenticated using ((auth.uid() = id));

drop policy if exists profiles_office_all on public.profiles;
create policy profiles_office_all on public.profiles as permissive for all to authenticated using (is_office()) with check (is_office());

drop policy if exists profiles_select_own_or_office on public.profiles;
create policy profiles_select_own_or_office on public.profiles as permissive for select to authenticated using ((is_office() OR (id = auth.uid())));

drop policy if exists rates_office_write on public.rates;
create policy rates_office_write on public.rates as permissive for all to authenticated using (is_office()) with check (is_office());

drop policy if exists rates_select_authenticated on public.rates;
create policy rates_select_authenticated on public.rates as permissive for select to authenticated using (true);

drop policy if exists reminders_office_write on public.reminders;
create policy reminders_office_write on public.reminders as permissive for all to authenticated using (is_office()) with check (is_office());

drop policy if exists reminders_select_own_or_office on public.reminders;
create policy reminders_select_own_or_office on public.reminders as permissive for select to authenticated using ((is_office() OR ((entity_type = 'driver'::text) AND (entity_id = current_driver_id()))));

drop policy if exists trip_cargo_office_write on public.trip_cargo;
create policy trip_cargo_office_write on public.trip_cargo as permissive for all to authenticated using (is_office()) with check (is_office());

drop policy if exists trip_cargo_select_own_or_office on public.trip_cargo;
create policy trip_cargo_select_own_or_office on public.trip_cargo as permissive for select to authenticated using ((is_office() OR driver_owns_trip(trip_id) OR (is_manager() AND manager_owns_trip(trip_id))));

drop policy if exists trip_documents_office_write on public.trip_documents;
create policy trip_documents_office_write on public.trip_documents as permissive for all to authenticated using (is_office()) with check (is_office());

drop policy if exists trip_documents_select_own_or_office on public.trip_documents;
create policy trip_documents_select_own_or_office on public.trip_documents as permissive for select to authenticated using ((is_office() OR driver_owns_trip(trip_id) OR (is_manager() AND manager_owns_trip(trip_id))));

drop policy if exists trip_expenses_office_delete on public.trip_expenses;
create policy trip_expenses_office_delete on public.trip_expenses as permissive for delete to authenticated using (is_office());

drop policy if exists trip_expenses_office_insert on public.trip_expenses;
create policy trip_expenses_office_insert on public.trip_expenses as permissive for insert to authenticated with check (is_office());

drop policy if exists trip_expenses_office_update on public.trip_expenses;
create policy trip_expenses_office_update on public.trip_expenses as permissive for update to authenticated using (is_office()) with check (is_office());

drop policy if exists trip_expenses_select_own_or_office on public.trip_expenses;
create policy trip_expenses_select_own_or_office on public.trip_expenses as permissive for select to authenticated using ((is_office() OR driver_owns_trip(trip_id) OR (is_manager() AND manager_owns_trip(trip_id))));

drop policy if exists trip_segment_cargo_office_write on public.trip_segment_cargo;
create policy trip_segment_cargo_office_write on public.trip_segment_cargo as permissive for all to authenticated using (is_office()) with check (is_office());

drop policy if exists trip_segment_cargo_select_own_or_office on public.trip_segment_cargo;
create policy trip_segment_cargo_select_own_or_office on public.trip_segment_cargo as permissive for select to authenticated using ((is_office() OR driver_owns_segment_cargo(segment_id) OR (is_manager() AND manager_owns_segment_cargo(segment_id))));

drop policy if exists trip_segments_office_delete on public.trip_segments;
create policy trip_segments_office_delete on public.trip_segments as permissive for delete to authenticated using (is_office());

drop policy if exists trip_segments_office_insert on public.trip_segments;
create policy trip_segments_office_insert on public.trip_segments as permissive for insert to authenticated with check (is_office());

drop policy if exists trip_segments_office_update on public.trip_segments;
create policy trip_segments_office_update on public.trip_segments as permissive for update to authenticated using (is_office()) with check (is_office());

drop policy if exists trip_segments_select_own_or_office on public.trip_segments;
create policy trip_segments_select_own_or_office on public.trip_segments as permissive for select to authenticated using ((is_office() OR driver_owns_segment(id) OR driver_owns_trip(trip_id) OR (is_manager() AND manager_owns_trip(trip_id))));

drop policy if exists trips_office_delete on public.trips;
create policy trips_office_delete on public.trips as permissive for delete to authenticated using (is_office());

drop policy if exists trips_office_insert on public.trips;
create policy trips_office_insert on public.trips as permissive for insert to authenticated with check (is_office());

drop policy if exists trips_office_update on public.trips;
create policy trips_office_update on public.trips as permissive for update to authenticated using (is_office()) with check (is_office());

drop policy if exists trips_select_own_or_office on public.trips;
create policy trips_select_own_or_office on public.trips as permissive for select to authenticated using ((is_office() OR driver_owns_trip(id) OR (is_manager() AND manager_owns_trip(id))));

drop policy if exists trucks_office_write on public.trucks;
create policy trucks_office_write on public.trucks as permissive for all to authenticated using (is_office()) with check (is_office());

drop policy if exists trucks_select_authenticated on public.trucks;
create policy trucks_select_authenticated on public.trucks as permissive for select to authenticated using (true);

drop policy if exists users_office_select on public.users;
create policy users_office_select on public.users as permissive for select to authenticated using (is_office());

drop policy if exists users_office_write on public.users;
create policy users_office_write on public.users as permissive for all to authenticated using (is_office()) with check (is_office());

revoke all on table public.audit_log from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_log to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_log to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_log to service_role;

revoke all on table public.clients from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.clients to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.clients to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.clients to service_role;

revoke all on table public.contractors from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.contractors to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.contractors to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.contractors to service_role;

revoke all on table public.documents from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.documents to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.documents to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.documents to service_role;

revoke all on table public.driver_telegram_links from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.driver_telegram_links to service_role;

revoke all on table public.driver_transactions from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.driver_transactions to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.driver_transactions to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.driver_transactions to service_role;

revoke all on table public.drivers from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.drivers to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.drivers to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.drivers to service_role;

revoke all on table public.fixed_costs from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.fixed_costs to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.fixed_costs to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.fixed_costs to service_role;

revoke all on table public.forwarding_contractors from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.forwarding_contractors to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.forwarding_contractors to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.forwarding_contractors to service_role;

revoke all on table public.forwarding_expenses from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.forwarding_expenses to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.forwarding_expenses to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.forwarding_expenses to service_role;

revoke all on table public.forwarding_orders from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.forwarding_orders to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.forwarding_orders to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.forwarding_orders to service_role;

revoke all on table public.forwarding_points from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.forwarding_points to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.forwarding_points to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.forwarding_points to service_role;

revoke all on table public.locations from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.locations to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.locations to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.locations to service_role;

revoke all on table public.managers from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.managers to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.managers to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.managers to service_role;

revoke all on table public.profiles from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.profiles to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.profiles to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.profiles to service_role;

revoke all on table public.rates from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rates to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rates to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.rates to service_role;

revoke all on table public.reminders from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.reminders to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.reminders to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.reminders to service_role;

revoke all on table public.trip_cargo from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trip_cargo to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trip_cargo to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trip_cargo to service_role;

revoke all on table public.trip_counter from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trip_counter to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trip_counter to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trip_counter to service_role;

revoke all on table public.trip_documents from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trip_documents to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trip_documents to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trip_documents to service_role;

revoke all on table public.trip_expenses from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trip_expenses to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trip_expenses to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trip_expenses to service_role;

revoke all on table public.trip_segment_cargo from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trip_segment_cargo to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trip_segment_cargo to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trip_segment_cargo to service_role;

revoke all on table public.trip_segments from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trip_segments to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trip_segments to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trip_segments to service_role;

revoke all on table public.trips from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trips to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trips to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trips to service_role;

revoke all on table public.trucks from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trucks to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trucks to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.trucks to service_role;

revoke all on table public.users from public, anon, authenticated, service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.users to anon;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.users to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.users to service_role;

revoke all on function public.current_driver_id() from public, anon, authenticated, service_role;

grant execute on function public.current_driver_id() to public;

grant execute on function public.current_driver_id() to anon;

grant execute on function public.current_driver_id() to authenticated;

grant execute on function public.current_driver_id() to service_role;

revoke all on function public.current_manager_id() from public, anon, authenticated, service_role;

grant execute on function public.current_manager_id() to public;

grant execute on function public.current_manager_id() to anon;

grant execute on function public.current_manager_id() to authenticated;

grant execute on function public.current_manager_id() to service_role;

revoke all on function public.derive_profit_mode(p_trip_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.derive_profit_mode(p_trip_id uuid) to public;

grant execute on function public.derive_profit_mode(p_trip_id uuid) to anon;

grant execute on function public.derive_profit_mode(p_trip_id uuid) to authenticated;

grant execute on function public.derive_profit_mode(p_trip_id uuid) to service_role;

revoke all on function public.driver_has_client(p_client_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.driver_has_client(p_client_id uuid) to public;

grant execute on function public.driver_has_client(p_client_id uuid) to anon;

grant execute on function public.driver_has_client(p_client_id uuid) to authenticated;

grant execute on function public.driver_has_client(p_client_id uuid) to service_role;

revoke all on function public.driver_owns_segment(p_segment_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.driver_owns_segment(p_segment_id uuid) to public;

grant execute on function public.driver_owns_segment(p_segment_id uuid) to anon;

grant execute on function public.driver_owns_segment(p_segment_id uuid) to authenticated;

grant execute on function public.driver_owns_segment(p_segment_id uuid) to service_role;

revoke all on function public.driver_owns_segment_cargo(p_segment_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.driver_owns_segment_cargo(p_segment_id uuid) to public;

grant execute on function public.driver_owns_segment_cargo(p_segment_id uuid) to anon;

grant execute on function public.driver_owns_segment_cargo(p_segment_id uuid) to authenticated;

grant execute on function public.driver_owns_segment_cargo(p_segment_id uuid) to service_role;

revoke all on function public.driver_owns_trip(p_trip_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.driver_owns_trip(p_trip_id uuid) to public;

grant execute on function public.driver_owns_trip(p_trip_id uuid) to anon;

grant execute on function public.driver_owns_trip(p_trip_id uuid) to authenticated;

grant execute on function public.driver_owns_trip(p_trip_id uuid) to service_role;

revoke all on function public.driver_uses_contractor(p_contractor_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.driver_uses_contractor(p_contractor_id uuid) to public;

grant execute on function public.driver_uses_contractor(p_contractor_id uuid) to anon;

grant execute on function public.driver_uses_contractor(p_contractor_id uuid) to authenticated;

grant execute on function public.driver_uses_contractor(p_contractor_id uuid) to service_role;

revoke all on function public.exec_sql(query text) from public, anon, authenticated, service_role;

grant execute on function public.exec_sql(query text) to service_role;

revoke all on function public.exec_sql_json(query text) from public, anon, authenticated, service_role;

grant execute on function public.exec_sql_json(query text) to service_role;

revoke all on function public.fixed_costs_by_month(p_year integer) from public, anon, authenticated, service_role;

grant execute on function public.fixed_costs_by_month(p_year integer) to public;

grant execute on function public.fixed_costs_by_month(p_year integer) to anon;

grant execute on function public.fixed_costs_by_month(p_year integer) to authenticated;

grant execute on function public.fixed_costs_by_month(p_year integer) to service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated, service_role;

grant execute on function public.handle_new_user() to public;

grant execute on function public.handle_new_user() to anon;

grant execute on function public.handle_new_user() to authenticated;

grant execute on function public.handle_new_user() to service_role;

revoke all on function public.is_manager() from public, anon, authenticated, service_role;

grant execute on function public.is_manager() to public;

grant execute on function public.is_manager() to anon;

grant execute on function public.is_manager() to authenticated;

grant execute on function public.is_manager() to service_role;

revoke all on function public.is_office() from public, anon, authenticated, service_role;

grant execute on function public.is_office() to public;

grant execute on function public.is_office() to anon;

grant execute on function public.is_office() to authenticated;

grant execute on function public.is_office() to service_role;

revoke all on function public.lookup_login_email(p_login text) from public, anon, authenticated, service_role;

grant execute on function public.lookup_login_email(p_login text) to service_role;

revoke all on function public.manager_has_client(p_client_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.manager_has_client(p_client_id uuid) to public;

grant execute on function public.manager_has_client(p_client_id uuid) to anon;

grant execute on function public.manager_has_client(p_client_id uuid) to authenticated;

grant execute on function public.manager_has_client(p_client_id uuid) to service_role;

revoke all on function public.manager_owns_segment_cargo(p_segment_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.manager_owns_segment_cargo(p_segment_id uuid) to public;

grant execute on function public.manager_owns_segment_cargo(p_segment_id uuid) to anon;

grant execute on function public.manager_owns_segment_cargo(p_segment_id uuid) to authenticated;

grant execute on function public.manager_owns_segment_cargo(p_segment_id uuid) to service_role;

revoke all on function public.manager_owns_trip(p_trip_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.manager_owns_trip(p_trip_id uuid) to public;

grant execute on function public.manager_owns_trip(p_trip_id uuid) to anon;

grant execute on function public.manager_owns_trip(p_trip_id uuid) to authenticated;

grant execute on function public.manager_owns_trip(p_trip_id uuid) to service_role;

revoke all on function public.manager_uses_contractor(p_contractor_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.manager_uses_contractor(p_contractor_id uuid) to public;

grant execute on function public.manager_uses_contractor(p_contractor_id uuid) to anon;

grant execute on function public.manager_uses_contractor(p_contractor_id uuid) to authenticated;

grant execute on function public.manager_uses_contractor(p_contractor_id uuid) to service_role;

revoke all on function public.merge_clients(source_id uuid, target_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.merge_clients(source_id uuid, target_id uuid) to service_role;

revoke all on function public.merge_contractors(source_id uuid, target_id uuid) from public, anon, authenticated, service_role;

grant execute on function public.merge_contractors(source_id uuid, target_id uuid) to service_role;

revoke all on function public.renumber_all_trips() from public, anon, authenticated, service_role;

grant execute on function public.renumber_all_trips() to public;

grant execute on function public.renumber_all_trips() to anon;

grant execute on function public.renumber_all_trips() to authenticated;

grant execute on function public.renumber_all_trips() to service_role;

revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role;

grant execute on function public.rls_auto_enable() to public;

grant execute on function public.rls_auto_enable() to anon;

grant execute on function public.rls_auto_enable() to authenticated;

grant execute on function public.rls_auto_enable() to service_role;

revoke all on function public.sync_trip_from_segment() from public, anon, authenticated, service_role;

grant execute on function public.sync_trip_from_segment() to public;

grant execute on function public.sync_trip_from_segment() to anon;

grant execute on function public.sync_trip_from_segment() to authenticated;

grant execute on function public.sync_trip_from_segment() to service_role;

revoke all on function public.trg_profiles_manager_needs_card() from public, anon, authenticated, service_role;

grant execute on function public.trg_profiles_manager_needs_card() to public;

grant execute on function public.trg_profiles_manager_needs_card() to anon;

grant execute on function public.trg_profiles_manager_needs_card() to authenticated;

grant execute on function public.trg_profiles_manager_needs_card() to service_role;

revoke all on function public.trg_segment_renumber() from public, anon, authenticated, service_role;

grant execute on function public.trg_segment_renumber() to public;

grant execute on function public.trg_segment_renumber() to anon;

grant execute on function public.trg_segment_renumber() to authenticated;

grant execute on function public.trg_segment_renumber() to service_role;

revoke all on function public.trg_trip_renumber() from public, anon, authenticated, service_role;

grant execute on function public.trg_trip_renumber() to public;

grant execute on function public.trg_trip_renumber() to anon;

grant execute on function public.trg_trip_renumber() to authenticated;

grant execute on function public.trg_trip_renumber() to service_role;

do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('documents', 'documents', true) on conflict (id) do nothing;
  end if;
end $$;

comment on table public.driver_telegram_links is 'Одноразовые токены привязки Telegram к водителю (хранится SHA-256). Доступ только service_role.';

comment on column public.fixed_costs.capex_rule is 'Правило автоопределения CAPEX: asset | purchase | below_threshold | none';

comment on table public.managers is 'Справочник менеджеров по логистике. Связь с учётной записью — managers.user_id, с профилем — profiles.manager_id.';

comment on column public.managers.password_updated_at is 'Когда офис в последний раз задал или сменил пароль менеджера.';

comment on column public.profiles.manager_id is 'Карточка менеджера (managers.id) для роли manager. NULL у офиса и водителей.';

comment on column public.trips.manager_id is 'Ответственный менеджер. NULL = заказ не назначен, виден всем менеджерам (общий пул офиса).';

-- Профиль при регистрации пользователя (триггер на auth.users, схема auth
-- в выгрузку не входит — определение снято с прода 14.11.2026).
do $$ begin
  if to_regclass('auth.users') is not null then
    drop trigger if exists on_auth_user_created on auth.users;
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;

commit;
