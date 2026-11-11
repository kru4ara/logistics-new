-- ============================================================
-- Фаза 39 — менеджер по логистике: справочник managers и привязка заказов.
--
-- Зафиксировано 11.11.2026:
--
--   Роль 'manager' перестаёт быть синонимом офиса. Раньше
--   ROLE_ALIASES в lib/roles.ts отображал manager -> office, и
--   is_office() считал role in ('office','admin','manager') офисом.
--   Теперь manager — отдельная роль менеджера по логистике:
--   видит всё то же, что офис, КРОМЕ заказов, назначенных на
--   другого менеджера; без доступа к аудиту и экспорту в Excel.
--
--   Что делает миграция:
--
--   1. Таблица public.managers — справочник менеджеров
--      (по образцу drivers: карточка + привязка к учётной записи).
--
--   2. profiles.manager_id — профиль пользователя указывает на карточку
--      менеджера. Аналог profiles.driver_id для водителей.
--
--   3. trips.manager_id — на ком лежит ответственный менеджер.
--      NULL = заказ не назначен, такой заказ виден всем менеджерам
--      (общий пул офиса).
--
--   4. Функции is_manager() / current_manager_id() и расширение
--      политик trips и trip_segments: менеджер видит свои заказы
--      и неназначенные, но не чужие.
--
--   5. Старые профили с role='manager' переводятся в 'office':
--      раньше manager был офисом, и такой человек должен сохранить
--      все офисные права. Без этого перевода он потерял бы доступ.
--
--   6. lookup_login_email дополняется поиском по managers — чтобы
--      менеджер мог войти по своему логину.
--
-- ВАЖНО про рекурсию: политика trips ссылается на trip_segments,
-- а политика trip_segments — на trips. Прямые ссылки дают
-- "infinite recursion detected in policy". Поэтому проверки
-- вынесены в security-definer функции: внутри них RLS не
-- применяется, и цепочка конечна.
-- ============================================================


-- ============================================================
-- 1. Справочник менеджеров
-- ============================================================

create table if not exists public.managers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  telegram_chat_id text,
  -- Учётная запись Supabase Auth (как drivers.user_id).
  user_id uuid,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.managers is
  'Справочник менеджеров по логистике. Связь с учётной записью — managers.user_id, с профилем — profiles.manager_id.';

-- Заказы без назначенного менеджера видны всем менеджерам,
-- поэтому индекс по manager_id нужен на фильтр.
create index if not exists idx_trips_manager_id on public.trips (manager_id);
create index if not exists idx_profiles_manager_id on public.profiles (manager_id);


-- ============================================================
-- 2. Привязка профиля к карточке менеджера
-- ============================================================

alter table public.profiles
  add column if not exists manager_id uuid references public.managers (id) on delete set null;

comment on column public.profiles.manager_id is
  'Карточка менеджера (managers.id) для роли manager. NULL у офиса и водителей.';


-- ============================================================
-- 3. Привязка заказа к менеджеру
-- ============================================================

alter table public.trips
  add column if not exists manager_id uuid references public.managers (id) on delete set null;

comment on column public.trips.manager_id is
  'Ответственный менеджер. NULL = заказ не назначен, виден всем менеджерам (общий пул офиса).';


-- ============================================================
-- 4. Перевод прежних manager'ов в офис
--
-- Раньше role='manager' означал офиса. Такой профиль должен
-- сохранить офисные права, иначе после смены смысла роли он
-- потерял бы доступ к заказам, деньгам и аналитике.
--
-- Новые менеджеры заводятся уже с role='manager' и profiles.manager_id.
-- ============================================================

update public.profiles
   set role = 'office'
 where lower(btrim(role)) = 'manager'
   and manager_id is null;


-- ============================================================
-- 4a. is_office() больше не считает manager офисом
--
-- Функция была: role in ('office','admin','manager').
-- Если оставить 'manager' в списке, менеджер автоматически получил бы
-- ВСЕ офисные права на уровне БД, включая заказы чужих менеджеров
-- (политика trips_select_own_or_office опирается на is_office()).
--
-- Раньше это было безобидно: manager и был офисом. Теперь роль
-- разделилась, поэтому 'manager' из списка убираем.
--
-- Старые профили с role='manager' уже переведены в 'office' выше,
-- поэтому права никто не потеряет.
-- ============================================================

create or replace function public.is_office()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(btrim(p.role)) in ('office', 'admin')
  );
$$;


-- ============================================================
-- 5. Функции менеджера
-- ============================================================

-- Менеджер — профиль с ролью 'manager' и привязанной карточкой.
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(btrim(p.role)) = 'manager'
  );
$$;

-- Карточка менеджера текущего пользователя.
create or replace function public.current_manager_id()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.manager_id from public.profiles p where p.id = auth.uid();
$$;

-- Заказ в периметре менеджера: назначен на него ИЛИ менеджер не назначен.
--
-- Совпадает с правилом приложения (lib/scope-rules.ts):
--   manager_id is null  -> общий пул, виден всем менеджерам;
--   manager_id = mine   -> мой заказ;
--   иначе               -> чужой заказ, не виден.
create or replace function public.manager_owns_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id
      and (
        t.manager_id is null
        or t.manager_id = public.current_manager_id()
      )
  );
$$;


-- ============================================================
-- 6. Политики
--
-- trips: менеджер видит свои + неназначенные.
-- trip_segments: то же через manager_owns_trip(trip_id).
-- ============================================================

drop policy if exists trips_select_own_or_office on public.trips;

create policy trips_select_own_or_office
  on public.trips for select
  using (
    is_office()
    or driver_owns_trip(id)
    or (is_manager() and manager_owns_trip(id))
  );

drop policy if exists trip_segments_select_own_or_office on public.trip_segments;

create policy trip_segments_select_own_or_office
  on public.trip_segments for select
  using (
    is_office()
    or driver_owns_segment(id)
    or driver_owns_trip(trip_id)
    or (is_manager() and manager_owns_trip(trip_id))
  );


-- ============================================================
-- 8. RLS справочника managers
-- ============================================================
--
-- В Supabase роль anon по умолчанию получает SELECT на все таблицы
-- public (дефолтные гранты). Новая таблица managers без RLS была бы
-- отдана анониму целиком — вместе с телефоном, e-mail и заметками.
-- Поэтому RLS включаем явно.
--
-- Правила:
--   - офис видит все карточки (ведёт справочник);
--   - менеджер видит свою карточку (нужна для подписи заказов);
--   - аноним не видит ничего.
--
-- Запись (insert/update/delete) — только офис: карточку заводит офис.
-- service_role (admin-клиент приложения) RLS обходит, поэтому
-- приложение работает как раньше.

alter table public.managers enable row level security;

drop policy if exists managers_select_own_or_office on public.managers;

create policy managers_select_own_or_office
  on public.managers for select
  using (
    is_office()
    or (is_manager() and id = public.current_manager_id())
  );

drop policy if exists managers_insert_office on public.managers;

create policy managers_insert_office
  on public.managers for insert
  with check (is_office());

drop policy if exists managers_update_office on public.managers;

create policy managers_update_office
  on public.managers for update
  using (is_office())
  with check (is_office());

drop policy if exists managers_delete_office on public.managers;

create policy managers_delete_office
  on public.managers for delete
  using (is_office());

-- Анониму SELECT не нужен вовсе: убираем и грант, чтобы карточки
-- не отдавались даже при случайном отключении политики.
revoke select on public.managers from anon;

-- ============================================================
-- 7. Вход менеджера по логину
--
-- lookup_login_email ищет e-mail по логину: сначала в users,
-- затем у водителя по фамилии. Добавляем менеджера.
--
-- Ищем по managers.full_name — так же, как для водителя по last_name.
-- ============================================================

create or replace function public.lookup_login_email(p_login text)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_email text;
begin
  if p_login is null or btrim(p_login) = '' then
    return null;
  end if;

  select u.email into v_email
  from public.users u
  where lower(btrim(u.login)) = lower(btrim(p_login))
  limit 1;

  if v_email is not null then
    return v_email;
  end if;

  select d.email into v_email
  from public.drivers d
  where lower(d.last_name) = lower(btrim(p_login))
  limit 1;

  if v_email is not null then
    return v_email;
  end if;

  select m.email into v_email
  from public.managers m
  where lower(m.full_name) = lower(btrim(p_login))
  limit 1;

  return v_email;
end;
$$;
