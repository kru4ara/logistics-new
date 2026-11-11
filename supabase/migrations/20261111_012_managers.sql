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



--
-- ВАЖНО: вся миграция обёрнута в транзакцию.
--
-- `psql -f` без BEGIN применяет каждую команду отдельно и коммитит её:
-- при ошибке на середине файла база остаётся в полуприменённом
-- состоянии (часть таблиц и функций создана, часть — нет), и следующий
-- прогон падает уже на другой строке. Транзакция откатывает всё
-- целиком: либо миграция применена полностью, либо не тронута вовсе.
--
begin;

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

-- Индексы по manager_id создаём ТОЛЬКО ЗДЕСЬ — после ALTER TABLE.
--
-- Раньше индексы стояли выше, до добавления колонок, и миграция падала
-- с "42703: column manager_id does not exist": CREATE INDEX требует
-- существующей колонки. Транзакция откатывала всё, включая таблицу
-- managers, — база оставалась без изменений, а код в приложении уже
-- читал profiles.manager_id и падал в редирект-цикл.
create index if not exists idx_trips_manager_id on public.trips (manager_id);
create index if not exists idx_profiles_manager_id on public.profiles (manager_id);


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

-- Права на функции-владельцы (фаза 39).
--
-- Политики вызывают их от имени пользователя (менеджера), поэтому явный
-- grant execute обязателен: без него вызов падает с "permission denied for
-- function ...", и политика молча отсекает ВСЕ строки — менеджер увидит
-- пустую выдачу вместо своих заказов.
--
-- ВАЖНО: блок стоит ПОСЛЕ создания функций. GRANT на ещё не созданную
-- функцию падает с "function ... does not exist" и роняет всю миграцию.
grant execute on function public.is_office() to anon, authenticated, service_role;
grant execute on function public.is_manager() to anon, authenticated, service_role;
grant execute on function public.current_manager_id() to anon, authenticated, service_role;
grant execute on function public.manager_owns_trip(uuid) to anon, authenticated, service_role;


-- ============================================================
-- 5b. Хелперы менеджера для остальных таблиц
-- ============================================================
--
-- Заказы менеджер видит (политика trips ниже), но без содержимого он
-- не увидит расходы, груз, документы, клиентов и подрядчиков своих
-- заказов — а без этого карточка заказа в приложении будет пустой.
--
-- Функции — security definer и с row_security = off: внутри них мы
-- читаем trips/trip_segments напрямую. Прямой подзапрос в политике
-- здесь дал бы рекурсию политик (та же ошибка, что чинили в фазе 35).

-- Клиент стоит на заказе, который менеджер ведёт.
create or replace function public.manager_has_client(p_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select exists (
    select 1 from public.trips t
    where t.client_id = p_client_id
      and public.manager_owns_trip(t.id)
  );
$$;

-- Подрядчик работает на сегменте заказа менеджера.
create or replace function public.manager_uses_contractor(p_contractor_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select exists (
    select 1 from public.trip_segments s
    where s.contractor_id = p_contractor_id
      and public.manager_owns_trip(s.trip_id)
  );
$$;

-- Груз лежит на сегменте заказа менеджера.
create or replace function public.manager_owns_segment_cargo(p_segment_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select exists (
    select 1 from public.trip_segments s
    where s.id = p_segment_id
      and public.manager_owns_trip(s.trip_id)
  );
$$;

grant execute on function public.manager_has_client(uuid) to anon, authenticated, service_role;
grant execute on function public.manager_uses_contractor(uuid) to anon, authenticated, service_role;
grant execute on function public.manager_owns_segment_cargo(uuid) to anon, authenticated, service_role;


-- ============================================================
-- 5c. Постоянное правило: role='manager' без карточки => office
-- ============================================================
--
-- Одноразовый UPDATE выше чинит только уже существующие профили. Но
-- профиль может появиться и позже (или карточка отвяжется), и тогда
-- он снова окажется в состоянии "manager без карточки" — то есть
-- без прав вообще: роль manager требует карточки.
--
-- Триггер делает правило постоянным: такой профиль автоматически
-- становится офисом. Управление карточкой — отдельная операция.
--
create or replace function public.trg_profiles_manager_needs_card()
returns trigger
language plpgsql
as $$
begin
  if lower(btrim(new.role)) = 'manager' and new.manager_id is null then
    new.role := 'office';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_manager_needs_card on public.profiles;
create trigger trg_profiles_manager_needs_card
  before insert or update of role, manager_id on public.profiles
  for each row execute function public.trg_profiles_manager_needs_card();

grant execute on function public.trg_profiles_manager_needs_card() to anon, authenticated, service_role;

-- 6. Политики
--
-- trips: менеджер видит свои + неназначенные.
-- trip_segments: то же через manager_owns_trip(trip_id).
-- ============================================================

drop policy if exists trips_select_own_or_office on public.trips;

--
-- ВАЖНО: `to authenticated` обязателен.
--
-- Политика без указания роли применяется ко ВСЕМ, включая anon. А
-- auth.uid() при set role anon всё равно читает request.jwt.claim.sub,
-- который в тестах не сброшен. Без `to authenticated` анонимный
-- посетитель получал чужие заказы (найдено на CI в фазе 39).
--
create policy trips_select_own_or_office
  on public.trips for select to authenticated
  using (
    is_office()
    or driver_owns_trip(id)
    or (is_manager() and manager_owns_trip(id))
  );

drop policy if exists trip_segments_select_own_or_office on public.trip_segments;

create policy trip_segments_select_own_or_office
  on public.trip_segments for select to authenticated
  using (
    is_office()
    or driver_owns_segment(id)
    or driver_owns_trip(trip_id)
    or (is_manager() and manager_owns_trip(trip_id))
  );


-- ============================================================

-- ============================================================
-- 6b. Политики для содержимого заказов менеджера
-- ============================================================
--
-- Менеджер ведёт заказы, поэтому должен видеть их содержимое:
-- расходы, груз, документы, клиентов, подрядчиков.
-- Политики master работают только через driver_owns_trip()/is_office(),
-- то есть для менеджера они не срабатывают — карточка заказа была бы
-- пустой. Поэтому пересоздаём их с веткой менеджера.
--
-- Запись (insert/update/delete) остаётся только у офиса: менеджер
-- правит заказ через server action с проверкой скоупа в коде, а не
-- прямыми вставками в таблицы.

drop policy if exists trip_expenses_select_own_or_office on public.trip_expenses;
create policy trip_expenses_select_own_or_office
  on public.trip_expenses for select to authenticated
  using (
    is_office()
    or driver_owns_trip(trip_expenses.trip_id)
    or (is_manager() and manager_owns_trip(trip_expenses.trip_id))
  );

drop policy if exists trip_cargo_select_own_or_office on public.trip_cargo;
create policy trip_cargo_select_own_or_office
  on public.trip_cargo for select to authenticated
  using (
    is_office()
    or driver_owns_trip(trip_cargo.trip_id)
    or (is_manager() and manager_owns_trip(trip_cargo.trip_id))
  );

drop policy if exists trip_segment_cargo_select_own_or_office on public.trip_segment_cargo;
create policy trip_segment_cargo_select_own_or_office
  on public.trip_segment_cargo for select to authenticated
  using (
    is_office()
    or driver_owns_segment_cargo(trip_segment_cargo.segment_id)
    or (is_manager() and manager_owns_segment_cargo(trip_segment_cargo.segment_id))
  );

drop policy if exists trip_documents_select_own_or_office on public.trip_documents;
create policy trip_documents_select_own_or_office
  on public.trip_documents for select to authenticated
  using (
    is_office()
    or driver_owns_trip(trip_documents.trip_id)
    or (is_manager() and manager_owns_trip(trip_documents.trip_id))
  );

drop policy if exists clients_select_own_or_office on public.clients;
create policy clients_select_own_or_office
  on public.clients for select to authenticated
  using (
    is_office()
    or driver_has_client(clients.id)
    or (is_manager() and manager_has_client(clients.id))
  );

drop policy if exists contractors_select_own_or_office on public.contractors;
create policy contractors_select_own_or_office
  on public.contractors for select to authenticated
  using (
    is_office()
    or driver_uses_contractor(contractors.id)
    or (is_manager() and manager_uses_contractor(contractors.id))
  );

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
  on public.managers for select to authenticated
  using (
    is_office()
    or (is_manager() and id = public.current_manager_id())
  );

drop policy if exists managers_insert_office on public.managers;

create policy managers_insert_office
  on public.managers for insert to authenticated
  with check (is_office());

drop policy if exists managers_update_office on public.managers;

create policy managers_update_office
  on public.managers for update to authenticated
  using (is_office())
  with check (is_office());

drop policy if exists managers_delete_office on public.managers;

create policy managers_delete_office
  on public.managers for delete to authenticated
  using (is_office());

-- Грант SELECT на managers у anon остаётся (как на все таблицы public
-- по умолчанию) — закрывает его RLS-политика: для анонима условие
-- using ложно, поэтому anon получает 0 строк, а не ошибку доступа.
-- Отзывать грант здесь не нужно: это ломало бы проверку «anon не видит
-- карточки» (она ждала 0 строк, а получала бы permission denied).

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

-- ============================================================
-- Проверка: все нужные политики и функции на месте
-- ============================================================
--
-- Раньше такая проверка была только в миграции 004, и поломка
-- обнаруживалась уже на следующем прогоне тестов — с невнятным
-- "ожидалось 0, получено N". Здесь проверяем сразу после
-- применения, чтобы падение было сразу и с точным текстом.
do $$
declare
  missing text := '';
  t text;
begin
  foreach t in array array[
    'trips', 'trip_segments', 'trip_expenses', 'trip_cargo',
    'trip_segment_cargo', 'trip_documents', 'clients', 'contractors',
    'managers'
  ] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = t
        and policyname like '%_select_own_or_office'
    ) then
      missing := missing || t || ' ';
    end if;
  end loop;

  if missing <> '' then
    raise exception 'RLS: нет политики чтения для: %', missing;
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_manager'
  ) then
    raise exception 'RLS: функция public.is_manager() не создана';
  end if;

  raise notice 'ok: политики чтения и функции менеджера на месте';
end;
$$;

commit;
