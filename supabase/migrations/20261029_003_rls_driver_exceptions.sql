-- ============================================================
-- Фаза 32 (часть 3) — сегментное владение и исключения для водителя
-- ============================================================
-- Применять ПОСЛЕ файлов 001 и 002.
--
-- Фаза 33 переводит драйверские страницы на RLS-клиент (anon-ключ +
-- сессия) вместо admin-клиента. Там RLS начинает работать по-настоящему,
-- и вылезают несоответствия, которых не видно со стороны service_role.
--
-- 1. Приложение считает, что водитель может быть назначен на ОДИН
--    сегмент рейса, а рейс целиком ведёт другой водитель. Проверка
--    в коде это учитывает (isTripOwner || isSegmentOwner), а политики
--    из 001 — нет: они смотрели только на trips.driver_id. Под RLS
--    такой водитель потерял бы и рейс, и сегменты.
--    -> добавляем driver_owns_trip / driver_owns_segment и расширяем
--    политики на них.
--
-- 2. Драйверские страницы джойнят clients(name) и contractors(name).
--    В 002 обе таблицы были строго для офиса -> джойн отдавал бы пустое
--    имя. Водитель видит клиента и подрядчика СВОИХ рейсов/сегментов.
--
-- ВАЖНО про рекурсию: политика trips ссылается на trip_segments, а
-- политика trip_segments — на trips. Прямые ссылки дают "infinite
-- recursion detected in policy". Поэтому проверки вынесены в
-- security-definer функции: внутри них RLS не применяется, и цепочка
-- конечна.
-- ============================================================


-- ============================================================
-- 1. Функции владения
-- ============================================================

-- Водитель владеет рейсом, если он назначен на рейс целиком
-- ИЛИ хотя бы на один его сегмент.
create or replace function public.driver_owns_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
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
as $$
  select exists (
    select 1 from public.trip_segments s
    where s.id = p_segment_id
      and s.driver_id = public.current_driver_id()
  );
$$;


-- ============================================================
-- 2. Расширенные политики выбора
-- ============================================================

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
    or exists (
      select 1
      from public.trip_segments s
      where s.id = trip_segment_cargo.segment_id
        and (
          public.driver_owns_segment(s.id)
          or public.driver_owns_trip(s.trip_id)
        )
    )
  );

drop policy if exists trip_documents_select_own_or_office on public.trip_documents;
create policy trip_documents_select_own_or_office on public.trip_documents
  for select to authenticated
  using (
    public.is_office()
    or public.driver_owns_trip(trip_documents.trip_id)
  );


-- ============================================================
-- 3. Клиенты и подрядчики водителя
-- ============================================================

-- clients: водитель читает клиентов СВОИХ рейсов. Имя клиента на своём
-- рейсе — не секрет, а без этого джойн clients(name) в драйверских
-- страницах отдаёт пустое имя.
-- В 002 клиенты были строго для офиса (clients_office_select) — снимаем
-- её, иначе она перекроет новую политику.
drop policy if exists clients_office_select on public.clients;
drop policy if exists clients_select_own_or_office on public.clients;
create policy clients_select_own_or_office on public.clients
  for select to authenticated
  using (
    public.is_office()
    or exists (
      select 1
      from public.trips t
      where t.client_id = clients.id
        and public.driver_owns_trip(t.id)
    )
  );

-- contractors: водитель читает подрядчиков СВОИХ сегментов.
-- Аналогично для подрядчиков.
drop policy if exists contractors_office_select on public.contractors;
drop policy if exists contractors_select_own_or_office on public.contractors;
create policy contractors_select_own_or_office on public.contractors
  for select to authenticated
  using (
    public.is_office()
    or exists (
      select 1
      from public.trip_segments s
      where s.contractor_id = contractors.id
        and (
          public.driver_owns_segment(s.id)
          or public.driver_owns_trip(s.trip_id)
        )
    )
  );


-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop policy if exists trips_select_own_or_office on public.trips;
-- drop policy if exists trip_segments_select_own_or_office on public.trip_segments;
-- drop policy if exists trip_expenses_select_own_or_office on public.trip_expenses;
-- drop policy if exists trip_cargo_select_own_or_office on public.trip_cargo;
-- drop policy if exists trip_segment_cargo_select_own_or_office on public.trip_segment_cargo;
-- drop policy if exists trip_documents_select_own_or_office on public.trip_documents;
-- -- В 002 клиенты были строго для офиса (clients_office_select) — снимаем
-- её, иначе она перекроет новую политику.
drop policy if exists clients_office_select on public.clients;
drop policy if exists clients_select_own_or_office on public.clients;
-- -- Аналогично для подрядчиков.
drop policy if exists contractors_office_select on public.contractors;
drop policy if exists contractors_select_own_or_office on public.contractors;
-- drop function if exists public.driver_owns_trip(uuid);
-- drop function if exists public.driver_owns_segment(uuid);
