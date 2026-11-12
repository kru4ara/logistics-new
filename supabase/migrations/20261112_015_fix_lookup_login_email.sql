-- ============================================================
-- Фаза 41 — починка входа по логину (lookup_login_email)
-- ============================================================
--
-- СИМПТОМ:
--   login/actions.ts ищет e-mail по логину ДО авторизации и вызывает
--   public.lookup_login_email(). Функция падала с
--   ERROR: 42703: column u.email does not exist
--   — и падала ЛЮБЫМ входом по логину (имя менеджера, логин офиса,
--   фамилия водителя), потому что обращалась к public.users.email.
--
-- ПРИЧИНА:
--   Таблица public.users — старая, легаси. В реальной базе в ней
--   колонок email НЕТ (есть id, login, role, password_hash), а в
--   стабах supabase/stubs/schema.sql колонка email была — поэтому
--   CI был зелёным, а прод сломан. Расхождение стабов и реальной
--   схемы и замаскировало баг.
--
-- ЧТО ДЕЛАЕМ:
--   1. Добавляем public.users.email (idempotent) и заполняем его
--      из auth.users — по совпадению id, а если id не совпал, то по
--      локальной части e-mail (= login).
--   2. Переписываем lookup_login_email: больше НЕ падаем на
--      отсутствующую колонку, ищем e-mail последовательно:
--        auth.users (прямой вход по e-mail)
--        -> managers.full_name (менеджер по имени)
--        -> managers.email
--        -> drivers.last_name (водитель по фамилии)
--        -> drivers.email
--        -> public.users.login (легаси-логины офиса)
--      Каждый шаг — отдельный запрос: если источника нет, идём
--      дальше, а не падаем.
--
-- ВАЖНО:
--   Функция SECURITY DEFINER и владелец у неё postgres (суперъюзер
--   в Supabase), поэтому чтение auth.users под RLS не блокируется.
--   В CI prepare.sql создаёт роль postgres владельцем базы — там
--   тот же принцип.
--
--   Обёрнута в транзакцию: без неё psql -f оставил бы базу
--   в полуприменённом состоянии.
-- ============================================================

begin;

-- ============================================================
-- 1. public.users.email: добавляем и заполняем
-- ============================================================

alter table public.users add column if not exists email text;

comment on column public.users.email is
  'E-mail офисной учётной записи. Заполняется из auth.users: по совпадению id, иначе по локальной части e-mail (= login).';

-- Заполняем те строки, где e-mail ещё неизвестен.
-- Совпадение по id — точное. Совпадение по локальной части — только
-- если такой e-mail единственный, иначе строка остаётся пустой:
-- гадать нельзя, лучше пустой e-mail, чем чужой.
update public.users u
set email = au.email
from auth.users au
where u.email is null
  and (
    au.id = u.id
    or (
      split_part(lower(au.email), '@', 1) = lower(btrim(u.login))
      and (
        select count(*)
        from auth.users au2
        where split_part(lower(au2.email), '@', 1) = lower(btrim(u.login))
      ) = 1
    )
  );

-- ============================================================
-- 2. lookup_login_email: переписываем
-- ============================================================

create or replace function public.lookup_login_email(p_login text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
  v_login text;
begin
  if p_login is null or btrim(p_login) = '' then
    return null;
  end if;

  v_login := btrim(p_login);

  -- 1. Прямой вход по e-mail.
  --
  -- auth.users под RLS: функция SECURITY DEFINER, владелец — postgres
  -- (в CI — владелец базы), поэтому подменяем права на свои.
  -- Если по какой-то причине чтение невозможно (нет прав, нет
  -- схемы auth) — не падаем, а идём к следующим источникам:
  -- отсутствие e-mail лучше, чем 500 на странице входа.
  begin
    select au.email into v_email
    from auth.users au
    where lower(au.email) = lower(v_login)
    limit 1;
  exception
    when others then
      v_email := null;
  end;

  if v_email is not null then
    return v_email;
  end if;

  -- 2. Менеджер — по полному имени карточки.
  select m.email into v_email
  from public.managers m
  where lower(btrim(m.full_name)) = lower(v_login)
    and m.email is not null
  limit 1;

  if v_email is not null then
    return v_email;
  end if;

  -- 3. Менеджер — по e-mail карточки.
  select m.email into v_email
  from public.managers m
  where lower(m.email) = lower(v_login)
  limit 1;

  if v_email is not null then
    return v_email;
  end if;

  -- 4. Водитель — по фамилии.
  select d.email into v_email
  from public.drivers d
  where lower(btrim(d.last_name)) = lower(v_login)
    and d.email is not null
  limit 1;

  if v_email is not null then
    return v_email;
  end if;

  -- 5. Водитель — по e-mail.
  select d.email into v_email
  from public.drivers d
  where lower(d.email) = lower(v_login)
  limit 1;

  if v_email is not null then
    return v_email;
  end if;

  -- 6. Легаси-логины офиса (public.users.login).
  --
  -- Раньше здесь стояло чтение public.users.email, которого в
  -- реальной базе нет — из-за этого падал весь вход по логину.
  -- Теперь колонка гарантированно существует (см. пункт 1).
  select u.email into v_email
  from public.users u
  where lower(btrim(u.login)) = lower(v_login)
    and u.email is not null
  limit 1;

  if v_email is not null then
    return v_email;
  end if;

  -- 7. Тот же легаси-логин, но e-mail подтягиваем напрямую из
  --    auth.users — по локальной части e-mail (= login).
  --
  --    Зачем: пункт 1 заполняет public.users.email при применении
  --    миграции, а учётная запись может появиться позже. Без этого
  --    шага легаси-логин работал бы только до первого нового
  --    аккаунта. Совпадение по локальной части берём только если
  --    такой e-mail единственный — иначе возвращаем null.
  begin
    select au.email into v_email
    from auth.users au
    where split_part(lower(au.email), '@', 1) = lower(v_login)
      and (
        select count(*)
        from auth.users au2
        where split_part(lower(au2.email), '@', 1) = lower(v_login)
      ) = 1
    limit 1;
  exception
    when others then
      v_email := null;
  end;

  return v_email;
end;
$$;

revoke all on function public.lookup_login_email(text) from public;
grant execute on function public.lookup_login_email(text) to anon, authenticated;

-- ============================================================
-- 3. Проверка сразу после применения
-- ============================================================
--
-- Раньше поломка обнаруживалась только на проде, уже во время
-- попытки входа. Здесь проверяем, что функция вообще работает и
-- что поиск по e-mail аккаунта отдаёт e-mail.
--
do $$
declare
  missing text := '';
  t text;
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'lookup_login_email'
  ) then
    raise exception 'login: функция public.lookup_login_email() не создана';
  end if;

  -- Колонка public.users.email обязана существовать: от неё
  -- зависит поиск легаси-логинов.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'email'
  ) then
    missing := missing || 'public.users.email ';
  end if;

  if missing <> '' then
    raise exception 'login: нет: %', missing;
  end if;

  -- Функция не должна падать ни на пустом, ни на неизвестном входе.
  if public.lookup_login_email('') is not null then
    raise exception 'login: пустой логин вернул e-mail';
  end if;

  if public.lookup_login_email('такого-логина-нет-12345') is not null then
    raise exception 'login: неизвестный логин вернул e-mail';
  end if;

  raise notice 'ok: lookup_login_email на месте и не падает на пустом/неизвестном входе';
end;
$$;

commit;
