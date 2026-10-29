-- ============================================================
-- Фаза 32 (часть 1) — RLS: profiles, trips, trip_segments, trip_expenses
-- ============================================================
-- Контекст: приложение ходит в базу через admin-клиент (service_role),
-- который ОБХОДИТ RLS. Права держатся только на проверках в коде.
-- В репозитории не было НИ ОДНОЙ SQL-миграции -> все таблицы созданы
-- через Supabase UI, а дефолт в Supabase: RLS ВЫКЛЮЧЕН. Значит
-- anon-ключ (он публичный, лежит в клиентском бандле) читает ЛЮБУЮ
-- таблицу целиком. Эти миграции закрывают прямой доступ из интернета
-- и готовят базу к переводу страниц на RLS-клиент.
--
-- Связи:
--   auth.uid() -> profiles.id
--   profiles.driver_id -> drivers.id
--   trips.driver_id -> drivers.id
--   trip_segments.trip_id -> trips.id
--   trip_expenses.trip_id -> trips.id
--
-- Роли в БД: admin / manager / driver (алиасы office).
--
-- Применение: Supabase SQL Editor -> вставить -> Run.
-- Откат: секция ROLLBACK в конце файла.
-- ============================================================


-- ============================================================
-- Вспомогательные функции
-- ============================================================

-- Роль пользователя. admin и manager -> office (тот же смысл,
-- что ROLE_ALIASES в lib/roles.ts).
create or replace function public.is_office()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(btrim(p.role)) in ('office', 'admin', 'manager')
  );
$$;

-- id водителя, которому принадлежит профиль.
create or replace function public.current_driver_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.driver_id from public.profiles p where p.id = auth.uid();
$$;


-- ============================================================
-- profiles — источник правды для ролей
-- ============================================================
-- Читать свой профиль может любой авторизованный, офис — все.

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own_or_office on public.profiles;
create policy profiles_select_own_or_office on public.profiles
  for select to authenticated
  using (
    public.is_office()
    or id = auth.uid()
  );

drop policy if exists profiles_office_all on public.profiles;
create policy profiles_office_all on public.profiles
  for all to authenticated
  using (public.is_office())
  with check (public.is_office());

-- ============================================================
-- trips
-- ============================================================
-- SELECT: офис — все рейсы, водитель — только свои.
-- Запись: только офис. Водитель меняет статус своего рейса через
-- server action (admin-клиент), поэтому на уровне БД запись для
-- водителя запрещена.

alter table public.trips enable row level security;

drop policy if exists trips_select_own_or_office on public.trips;
create policy trips_select_own_or_office on public.trips
  for select to authenticated
  using (
    public.is_office()
    or driver_id = public.current_driver_id()
  );

drop policy if exists trips_office_insert on public.trips;
create policy trips_office_insert on public.trips
  for insert to authenticated
  with check (public.is_office());

drop policy if exists trips_office_update on public.trips;
create policy trips_office_update on public.trips
  for update to authenticated
  using (public.is_office())
  with check (public.is_office());

drop policy if exists trips_office_delete on public.trips;
create policy trips_office_delete on public.trips
  for delete to authenticated
  using (public.is_office());

-- ============================================================
-- trip_segments
-- ============================================================
-- Владелец сегмента определяется по его рейсу.

alter table public.trip_segments enable row level security;

drop policy if exists trip_segments_select_own_or_office on public.trip_segments;
create policy trip_segments_select_own_or_office on public.trip_segments
  for select to authenticated
  using (
    public.is_office()
    or exists (
      select 1 from public.trips t
      where t.id = trip_segments.trip_id
        and t.driver_id = public.current_driver_id()
    )
  );

drop policy if exists trip_segments_office_insert on public.trip_segments;
create policy trip_segments_office_insert on public.trip_segments
  for insert to authenticated
  with check (public.is_office());

drop policy if exists trip_segments_office_update on public.trip_segments;

drop policy if exists trip_segments_office_update on public.trip_segments;
create policy trip_segments_office_update on public.trip_segments
  for update to authenticated
  using (public.is_office())
  with check (public.is_office());

drop policy if exists trip_segments_office_delete on public.trip_segments;
create policy trip_segments_office_delete on public.trip_segments
  for delete to authenticated
  using (public.is_office());

-- ============================================================
-- trip_expenses
-- ============================================================
-- Расход принадлежит рейсу, рейс — водителю.

alter table public.trip_expenses enable row level security;

drop policy if exists trip_expenses_select_own_or_office on public.trip_expenses;
create policy trip_expenses_select_own_or_office on public.trip_expenses
  for select to authenticated
  using (
    public.is_office()
    or exists (
      select 1 from public.trips t
      where t.id = trip_expenses.trip_id
        and t.driver_id = public.current_driver_id()
    )
  );

drop policy if exists trip_expenses_office_insert on public.trip_expenses;
create policy trip_expenses_office_insert on public.trip_expenses
  for insert to authenticated
  with check (public.is_office());

drop policy if exists trip_expenses_office_update on public.trip_expenses;
create policy trip_expenses_office_update on public.trip_expenses
  for update to authenticated
  using (public.is_office())
  with check (public.is_office());

drop policy if exists trip_expenses_office_delete on public.trip_expenses;
create policy trip_expenses_office_delete on public.trip_expenses
  for delete to authenticated
  using (public.is_office());

-- ============================================================
-- ROLLBACK (выполнить вручную, если что-то пошло не так)
-- ============================================================
-- drop policy if exists profiles_select_own_or_office on public.profiles;
-- drop policy if exists profiles_office_all on public.profiles;
-- drop policy if exists trips_select_own_or_office on public.trips;
-- drop policy if exists trips_office_insert on public.trips;
-- drop policy if exists trips_office_update on public.trips;
-- drop policy if exists trips_office_delete on public.trips;
-- drop policy if exists trip_segments_select_own_or_office on public.trip_segments;
-- drop policy if exists trip_segments_office_insert on public.trip_segments;
-- drop policy if exists trip_segments_office_update on public.trip_segments;
-- drop policy if exists trip_segments_office_delete on public.trip_segments;
-- drop policy if exists trip_expenses_select_own_or_office on public.trip_expenses;
-- drop policy if exists trip_expenses_office_insert on public.trip_expenses;
-- drop policy if exists trip_expenses_office_update on public.trip_expenses;
-- drop policy if exists trip_expenses_office_delete on public.trip_expenses;
-- alter table public.profiles disable row level security;
-- alter table public.trips disable row level security;
-- alter table public.trip_segments disable row level security;
-- alter table public.trip_expenses disable row level security;
