-- ============================================================
-- 2026-11-01: Режим расчёта выводится из исполнителей
--
-- Зафиксировано 01.11.2026:
--   1. Получив заявку от клиента, мы ещё не знаем, кто повезёт груз.
--      Поэтому режим расчёта НЕ выбирается в форме — он вычисляется
--      из фактических исполнителей заказа (сегментов).
--   2. Правило вычисления (то же, что в lib/orders-core.ts,
--      функция deriveProfitMode):
--        - сегмент executor_type='us' с машиной И водителем -> 'trip';
--        - только подрядчик (executor_type='contractor'
--          с contractor_id) -> 'forwarding';
--        - смешанный заказ (есть и наш транспорт, и подрядчик) -> 'trip';
--          расходы подрядчика идут в прямые расходы рейса — как и было;
--        - нет ни одного сегмента -> режим не определён (null),
--          заказ не получает номер.
--   3. Смешанный заказ остаётся рейсом: третья математика не вводится,
--      годовая статистика и отчёты не меняются.
--
-- Применение: Supabase SQL Editor -> вставить -> Run.
-- Откат: секция ROLLBACK в конце файла.
-- ============================================================


-- ---------- 1. Функция вычисления режима ----------
--
-- Возвращает 'trip', 'forwarding' или NULL (режим не определён).
create or replace function public.derive_profit_mode(p_trip_id uuid)
 returns text
 language plpgsql
 stable
as $$
declare
  v_has_us boolean;
  v_has_contractor boolean;
begin
  select
    exists (
      select 1
        from public.trip_segments s
       where s.trip_id = p_trip_id
         and s.executor_type = 'us'
         and s.truck_id is not null
         and s.driver_id is not null
    ),
    exists (
      select 1
        from public.trip_segments s
       where s.trip_id = p_trip_id
         and s.executor_type = 'contractor'
         and s.contractor_id is not null
    )
    into v_has_us, v_has_contractor;

  if v_has_us then
    return 'trip';
  end if;
  if v_has_contractor then
    return 'forwarding';
  end if;
  return null;
end;
$$;

comment on function public.derive_profit_mode(uuid) is
  'Режим расчёта заказа из фактических исполнителей: us -> trip, только подрядчик -> forwarding, смешанный -> trip, нет сегментов -> null';


-- ---------- 2. Пересчёт режима у существующих заказов ----------
--
-- Бэкап перед изменением.
create table if not exists public.bak_trips_profit_mode_20261101 (
  id            uuid primary key,
  trip_number   text,
  profit_mode   text,
  backed_up_at  timestamptz default now()
);

insert into public.bak_trips_profit_mode_20261101 (id, trip_number, profit_mode)
select t.id, t.trip_number, t.profit_mode
  from public.trips t
 where coalesce(public.derive_profit_mode(t.id), 'trip') is distinct from t.profit_mode
 on conflict (id) do nothing;

update public.trips t
   set profit_mode = public.derive_profit_mode(t.id)
 where t.profit_mode is distinct from public.derive_profit_mode(t.id)
   and public.derive_profit_mode(t.id) is not null;


-- ---------- 3. Переписанный триггер синхронизации ----------
--
-- Раньше триггер ЧИТАЛ profit_mode заказа и по нему решал, что
-- синхронизировать. Теперь режим СНАЧАЛА вычисляется из всех
-- сегментов заказа, потом записывается, и только потом применяются
-- правила дат.
create or replace function public.sync_trip_from_segment()
 returns trigger
 language plpgsql
as $$
declare
  v_mode text;
begin
  -- 1. Режим выводится из всех сегментов заказа.
  v_mode := public.derive_profit_mode(NEW.trip_id);

  -- 2. Записываем режим в заказ (если он определён).
  if v_mode is not null then
    update public.trips
       set profit_mode = v_mode
     where id = NEW.trip_id
       and profit_mode is distinct from v_mode;
  end if;

  -- 3. Правила дат — по вычисленному режиму.
  if v_mode = 'forwarding' then
    -- Экспедирование: единственный исполнитель — подрядчик.
    if NEW.executor_type = 'contractor' then
      update public.trips
         set load_date   = coalesce(NEW.date_from, load_date),
             unload_date = coalesce(NEW.date_to,   unload_date)
       where id = NEW.trip_id;
    end if;
    return NEW;
  end if;

  if v_mode = 'trip' then
    -- Рейс: даты и транспорт из участка с нашей машиной.
    if NEW.executor_type = 'us' then
      update public.trips
         set truck_id   = coalesce(NEW.truck_id, truck_id),
             trailer_id = coalesce(NEW.trailer_id, trailer_id),
             driver_id  = coalesce(NEW.driver_id, driver_id),
             start_date = coalesce(NEW.date_from, start_date),
             end_date   = coalesce(NEW.date_to, end_date)
       where id = NEW.trip_id;
    end if;
    return NEW;
  end if;

  -- Режим не определён (сегментов нет) — даты не трогаем.
  return NEW;
end;
$$;

-- Триггер должен реагировать и на смену подрядчика/машины.
drop trigger if exists trg_sync_trip_from_segment on public.trip_segments;
create trigger trg_sync_trip_from_segment
after insert or update of truck_id, driver_id, date_from, date_to, executor_type, contractor_id
on public.trip_segments
for each row
execute function public.sync_trip_from_segment();


-- ---------- 4. Перенумерация после пересчёта режима ----------
--
-- Номер заказа зависит от ветки (рейс / экспедиция), поэтому после
-- смены режима нумерация пересчитывается.
select public.renumber_all_trips();


-- ============================================================
-- ROLLBACK
-- ============================================================
-- Откат режима заказов из бэкапа и возврат прежнего триггера.
--
-- update public.trips t
--    set profit_mode = b.profit_mode
--   from public.bak_trips_profit_mode_20261101 b
--  where b.id = t.id;
--
-- drop table if exists public.bak_trips_profit_mode_20261101;
--
-- create or replace function public.sync_trip_from_segment()
--  returns trigger
--  language plpgsql
-- as $$
-- declare
--   v_mode text;
-- begin
--   select coalesce(t.profit_mode, 'trip')
--     into v_mode
--     from public.trips t
--    where t.id = NEW.trip_id;
--
--   if v_mode = 'forwarding' then
--     if NEW.executor_type = 'contractor' then
--       update public.trips
--          set load_date   = coalesce(NEW.date_from, load_date),
--              unload_date = coalesce(NEW.date_to,   unload_date)
--        where id = NEW.trip_id;
--     end if;
--     return NEW;
--   end if;
--
--   if NEW.executor_type = 'us' then
--     update public.trips
--        set truck_id   = coalesce(NEW.truck_id, truck_id),
--            trailer_id = coalesce(NEW.trailer_id, trailer_id),
--            driver_id  = coalesce(NEW.driver_id, driver_id),
--            start_date = coalesce(NEW.date_from, start_date),
--            end_date   = coalesce(NEW.date_to, end_date)
--      where id = NEW.trip_id;
--   end if;
--
--   return NEW;
-- end;
-- $$;
--
-- drop trigger if exists trg_sync_trip_from_segment on public.trip_segments;
-- create trigger trg_sync_trip_from_segment
-- after insert or update of truck_id, driver_id, date_from, date_to, executor_type
-- on public.trip_segments
-- for each row
-- execute function public.sync_trip_from_segment();
