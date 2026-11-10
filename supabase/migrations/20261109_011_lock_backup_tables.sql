-- Бэкап-таблицы: закрываем публичный доступ и закрепляем защиту в git.
--
-- Контекст (аудит 09.11.2026, проверено на боевой базе 10.11.2026):
--
--   Бэкап-таблицы bak_* создавались на боевой базе вручную через
--   Supabase SQL Editor, поэтому в git их не было. Одна из них
--   (bak_trips_profit_mode_20261101) появилась миграцией 007.
--
--   В Postgres роль anon по умолчанию получает права на все таблицы
--   схемы public (дефолтные права postgres и supabase_admin:
--   anon=arwdDxtm). То есть на каждую новую таблицу public у anon
--   есть SELECT/INSERT/UPDATE/DELETE. Единственная линия защиты —
--   RLS.
--
--   На боевой базе RLS на всех семи bak_* включён: event-триггер
--   ensure_rls ловит в том числе 'CREATE TABLE AS', поэтому бэкапы
--   под защиту попали. Проверено 10.11.2026: на всех bak_*
--   rls=true, политик 0, прав у anon нет.
--
--   То есть утечки данных не было. Миграция закрывает хвост:
--   убирает лишние гранты anon/authenticated (защита в глубину на
--   случай, если RLS когда-нибудь выключат) и переносит в git
--   сам механизм защиты — на свежей базе, развёрнутой из миграций
--   репозитория, event-триггера не было бы вообще.
--
-- Что делает миграция:
--
--   1. Для всех существующих bak_* (включая те, которых ещё нет)
--      отзывает права anon/authenticated и включает RLS.
--      Перебор идёт по каталогу pg_class, поэтому миграция
--      применяется и на базе без части бэкапов, и дважды подряд.
--
--   2. Переносит в git функцию public.rls_auto_enable() и
--      event-триггер ensure_rls — с боевой базы, дословно,
--      с добавлением отзыва грантов для bak_*.
--
--   3. Политик на bak_* намеренно нет: при включённом RLS таблица
--      закрыта для всех, кроме владельца и service_role
--      (service_role RLS обходит).
--
-- Проверка после применения: на всех bak_* rls=true,
-- грантов anon=0; таблиц без RLS с грантами anon в базе нет.

-- ============================================================
-- 1. Права и RLS на существующие бэкап-таблицы
-- ============================================================

do $$
declare
  r record;
begin
  for r in
    select c.oid::regclass::text as tbl
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname like 'bak\_%'
  loop
    execute format('revoke all on table %s from anon, authenticated', r.tbl);
    execute format('alter table %s enable row level security', r.tbl);
    raise notice 'bak locked: %', r.tbl;
  end loop;
end;
$$;

-- ============================================================
-- 2. Защита от повторения: функция и event-триггер
-- ============================================================
--
-- Тело функции перенесено с боевой базы (10.11.2026) без
-- изменений, кроме дополнительного отзыва грантов для bak_*.
-- Фильтр по command_tag уже включал 'CREATE TABLE AS' и
-- 'SELECT INTO' — бэкап-таблицы и под это попадали.

create or replace function public.rls_auto_enable() returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
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
$$;

-- Event-триггер: на боевой базе он уже есть (evtname=ensure_rls,
-- evtevent=ddl_command_end, функция rls_auto_enable). CREATE EVENT
-- TRIGGER не поддерживает IF NOT EXISTS, поэтому проверяем вручную.
-- Создание требует суперпользователя — если прав нет, пропускаем
-- (в CI роль postgres суперпользователь, триггер создастся).
do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    execute 'create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable()';
    raise notice 'event trigger ensure_rls created';
  else
    raise notice 'event trigger ensure_rls already exists';
  end if;
exception
  when insufficient_privilege then
    raise notice 'нет прав на создание event trigger — пропускаем (RLS всё равно включится явно)';
end;
$$;
