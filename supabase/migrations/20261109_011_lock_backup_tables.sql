-- Бэкап-таблицы: закрываем публичный доступ.
--
-- Найдено на аудите 09.11.2026:
--
--   Таблицы bak_*_20261031 были созданы миграциями 31.10 как
--   CREATE TABLE ... AS SELECT внутри DO-блока. Event-триггер
--   ensure_rls ловит только 'CREATE TABLE', 'CREATE TABLE AS'
--   и 'SELECT INTO' — бэкап-таблицы под фильтр не попали,
--   и RLS на них так и не включился.
--
--   При этом в Postgres роль anon по умолчанию получает права
--   на все таблицы схемы public. Миграции 002/003 эти гранты
--   для bak_* не отзывали — в отличие от обычных таблиц,
--   где гранты чистились явно.
--
--   Итог: bak_trips_20261031 (77 рейсов с выручкой),
--   bak_forwarding_orders_20261031 (31 экспедиция) и ещё
--   четыре таблицы были доступны из интернета анонимно —
--   на SELECT, INSERT, UPDATE и DELETE.
--
--   Ключ anon лежит в NEXT_PUBLIC_SUPABASE_ANON_KEY и попадает
--   в клиентский бандл, то есть достаётся с любой страницы
--   приложения. Граница была не «аноним», а «любой, кто открыл сайт».
--
-- Что делает миграция:
--
--   1. Отзывает все права у anon и authenticated на bak_*.
--      Приложение ходит в бэкапы через service_role — ему права
--      не нужны, но оставляем (для бэкап-крона и ручных проверок).
--
--   2. Включает RLS на всех bak_*. Политик нет — значит при
--      включённом RLS доступ для всех закрыт, кроме владельца
--      и service_role (service_role RLS обходит).
--
--   3. Добавляет защиту от повторения: триггер ensure_rls
--      расширяется на команду 'CREATE TABLE AS' в DO-блоках
--      и включает RLS + отзывает гранты anon для таблиц,
--      созданных как bak_*.
--
-- Проверка после применения: на всех bak_* rls=true,
-- грантов anon=0; таблиц без RLS с грантами anon в базе нет.

-- ============================================================
-- 1. Отзыв публичных прав
-- ============================================================

revoke all on table public.bak_trips_20261031 from anon, authenticated;
revoke all on table public.bak_forwarding_orders_20261031 from anon, authenticated;
revoke all on table public.bak_forwarding_expenses_20261031 from anon, authenticated;
revoke all on table public.bak_forwarding_points_20261031 from anon, authenticated;
revoke all on table public.bak_forwarding_contractors_20261031 from anon, authenticated;
revoke all on table public.bak_fwd_segment_stops_20261031 from anon, authenticated;
revoke all on table public.bak_trips_profit_mode_20261101 from anon, authenticated;

-- ============================================================
-- 2. RLS на бэкап-таблицы
-- ============================================================

alter table public.bak_trips_20261031 enable row level security;
alter table public.bak_forwarding_orders_20261031 enable row level security;
alter table public.bak_forwarding_expenses_20261031 enable row level security;
alter table public.bak_forwarding_points_20261031 enable row level security;
alter table public.bak_forwarding_contractors_20261031 enable row level security;
alter table public.bak_fwd_segment_stops_20261031 enable row level security;
alter table public.bak_trips_profit_mode_20261101 enable row level security;

-- ============================================================
-- 3. Защита от повторения
--
-- Триггер ensure_rls и так включал RLS на CREATE TABLE —
-- но bak_* создавались как CREATE TABLE ... AS SELECT внутри
-- DO-блока, и команда не попадала в его фильтр. Теперь
-- фильтр шире, а для таблиц с именем bak_* дополнительно
-- отзываются гранты anon/authenticated.
-- ============================================================

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
       and cmd.object_identity not like 'pg_%'
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

-- Политик на bak_* намеренно нет: при включённом RLS таблица
-- закрыта для всех, кроме владельца и service_role.
