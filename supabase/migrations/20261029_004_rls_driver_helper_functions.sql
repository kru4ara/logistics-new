-- ============================================================
-- Фаза 35 — хелперы владения для RLS (чистые функции вместо подзапросов)
-- ============================================================
-- Применять ПОСЛЕ 003.
--
-- Проблема, найденная CI (фаза 34): водитель НЕ видел клиента своего
-- рейса. Проверка "driver A: client of own trip" упала: 0 вместо 1.
--
-- Причина: политика clients_select_own_or_office содержала ПРЯМОЙ
-- подзапрос к trips:
--
--     or exists (
--       select 1 from public.trips t
--       where t.client_id = clients.id
--         and public.driver_owns_trip(t.id)
--     )
--
-- Подзапрос в политике выполняется от имени ВОДИТЕЛЯ, то есть с
-- действующим RLS таблицы trips. RLS trips опирается на
-- driver_owns_trip(), а тот — на trip_segments, чья политика тоже
-- опирается на trips. Цепочка trips -> trip_segments -> trips
-- замыкается, и проверка вложенного подзапроса не даёт того, что
-- ожидалось.
--
-- Решение: убрать из политик прямые подзапросы к таблицам ВООБЩЕ.
-- Все проверки владения вынести в security definer функции, которые
-- читают trips/trip_segments напрямую (владелец функции обходит RLS).
-- В политике остаётся только вызов функции - цепочка не возникает.
--
-- Ничего не теряется: сегментный кейс (водитель назначен на ОДИН
-- сегмент чужого рейса) сохранён - driver_owns_trip() учитывает и
-- сегменты, и рейс целиком.
-- ============================================================


-- ============================================================
-- 1. Функции владения (все security definer)
-- ============================================================

-- Водитель владеет рейсом: назначен на рейс целиком ИЛИ хотя бы
-- на один его сегмент.
create or replace function public.driver_owns_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
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
$$;

-- Водитель владеет конкретным сегментом.
create or replace function public.driver_owns_segment(p_segment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.trip_segments s
    where s.id = p_segment_id
      and s.driver_id = public.current_driver_id()
  );
$$;

-- Водитель владеет грузом по сегменту: сегмент его ИЛИ рейс его.
create or replace function public.driver_owns_segment_cargo(p_segment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.trip_segments s
    where s.id = p_segment_id
      and (
        s.driver_id = public.current_driver_id()
        or public.driver_owns_trip(s.trip_id)
      )
  );
$$;

-- Водитель имеет дело с клиентом: клиент стоит на рейсе, который
-- водитель ведёт (целиком или по сегменту).
create or replace function public.driver_has_client(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.trips t
    where t.client_id = p_client_id
      and public.driver_owns_trip(t.id)
  );
$$;

-- Водитель работает с подрядчиком: подрядчик стоит на его сегменте
-- ИЛИ на его рейсе.
create or replace function public.driver_uses_contractor(p_contractor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.trip_segments s
    where s.contractor_id = p_contractor_id
      and (
        s.driver_id = public.current_driver_id()
        or public.driver_owns_trip(s.trip_id)
      )
  );
$$;


-- ============================================================
-- 2. Политики: только вызовы функций, без подзапросов к таблицам
-- ============================================================

-- Политики из 002 на trips/trip_cargo/trip_documents содержали прямые
-- подзапросы к trips — именно они ломались. Снимаем и создаём заново
-- через функции-владельцы.
drop policy if exists trips_select_own_or_office on public.trips;
create policy trips_select_own_or_office on public.trips
  for select to authenticated
  using (
    public.is_office()
    or public.driver_owns_trip(trips.id)
  );

drop policy if exists trip_segments_select_own_or_office on public.trip_segments;
create policy trip_segments_select_own_or_office on public.trip_segments
  for select to authenticated
  using (
    public.is_office()
    or public.driver_owns_segment(trip_segments.id)
    or public.driver_owns_trip(trip_segments.trip_id)
  );

drop policy if exists trip_expenses_select_own_or_office on public.trip_expenses;
create policy trip_expenses_select_own_or_office on public.trip_expenses
  for select to authenticated
  using (
    public.is_office()
    or public.driver_owns_trip(trip_expenses.trip_id)
  );

drop policy if exists trip_cargo_select_own_or_office on public.trip_cargo;
create policy trip_cargo_select_own_or_office on public.trip_cargo
  for select to authenticated
  using (
    public.is_office()
    or public.driver_owns_trip(trip_cargo.trip_id)
  );

drop policy if exists trip_segment_cargo_select_own_or_office on public.trip_segment_cargo;
create policy trip_segment_cargo_select_own_or_office on public.trip_segment_cargo
  for select to authenticated
  using (
    public.is_office()
    or public.driver_owns_segment_cargo(trip_segment_cargo.segment_id)
  );

drop policy if exists trip_documents_select_own_or_office on public.trip_documents;
create policy trip_documents_select_own_or_office on public.trip_documents
  for select to authenticated
  using (
    public.is_office()
    or public.driver_owns_trip(trip_documents.trip_id)
  );

-- Клиент своего рейса. Раньше здесь был прямой подзапрос к trips -
-- именно он и ломался в CI.
drop policy if exists clients_select_own_or_office on public.clients;
create policy clients_select_own_or_office on public.clients
  for select to authenticated
  using (
    public.is_office()
    or public.driver_has_client(clients.id)
  );

-- Подрядчик своего сегмента / своего рейса.
drop policy if exists contractors_select_own_or_office on public.contractors;
create policy contractors_select_own_or_office on public.contractors
  for select to authenticated
  using (
    public.is_office()
    or public.driver_uses_contractor(contractors.id)
  );


-- ============================================================
-- Права на функции-владельцы
-- ============================================================
-- Политики вызывают эти функции от имени ВОДИТЕЛЯ, поэтому явные
-- grant execute обязательны: без них вызов падает с
-- "permission denied for function driver_owns_trip", и политика
-- молча отсекает все строки (и офис, и водитель видят ноль).
grant execute on function public.driver_owns_trip(uuid) to anon, authenticated, service_role;
grant execute on function public.driver_owns_segment(uuid) to anon, authenticated, service_role;
grant execute on function public.driver_owns_segment_cargo(uuid) to anon, authenticated, service_role;
grant execute on function public.driver_has_client(uuid) to anon, authenticated, service_role;
grant execute on function public.driver_uses_contractor(uuid) to anon, authenticated, service_role;


-- ============================================================
-- ROLLBACK
-- ============================================================
-- -- Политики из 002 на trips/trip_cargo/trip_documents содержали прямые
-- подзапросы к trips — именно они ломались. Снимаем и создаём заново
-- через функции-владельцы.
drop policy if exists trips_select_own_or_office on public.trips;
-- drop policy if exists trip_segments_select_own_or_office on public.trip_segments;
-- drop policy if exists trip_expenses_select_own_or_office on public.trip_expenses;
-- drop policy if exists trip_cargo_select_own_or_office on public.trip_cargo;
-- drop policy if exists trip_segment_cargo_select_own_or_office on public.trip_segment_cargo;
-- drop policy if exists trip_documents_select_own_or_office on public.trip_documents;
-- drop policy if exists clients_select_own_or_office on public.clients;
-- drop policy if exists contractors_select_own_or_office on public.contractors;
-- drop function if exists public.driver_owns_trip(uuid);
-- drop function if exists public.driver_owns_segment(uuid);
-- drop function if exists public.driver_owns_segment_cargo(uuid);
-- drop function if exists public.driver_has_client(uuid);
-- drop function if exists public.driver_uses_contractor(uuid);
