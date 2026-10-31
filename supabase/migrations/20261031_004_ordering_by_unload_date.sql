-- ============================================================
-- 2026-10-31 (часть 4): Месяц заказа, сортировка и нумерация
--                       ПО ДАТЕ ВЫГРУЗКИ
--
-- Правило:
--   - заказ относится к месяцу даты ВЫГРУЗКИ;
--     загружен в сентябре, выгружен в октябре -> октябрьский;
--   - общая сортировка по дате выгрузки;
--   - нумерация по дате выгрузки ASC, ветки независимые:
--       рейс        -> '42'
--       экспедиция -> '42Е'
--
-- Дата выгрузки:
--   рейс       -> end_date   (финиш),  запасной start_date
--   экспедиция -> unload_date (разгрузка), запасной load_date
--
-- ВНИМАНИЕ: запасной вариант убран миграцией
-- 20261101_005_numbering_by_unload_date_strict.sql — нумерация
-- теперь строго по дате выгрузки. Эта миграция остаётся для истории
-- и для отката: применять её следует ДО 005.
--
-- Применение: Supabase SQL Editor -> вставить -> Run.
-- Откат: секция ROLLBACK в конце файла.
-- ============================================================


-- ---------- 1. Нумерация по дате выгрузки ----------
create or replace function public.renumber_all_trips()
 returns void
 language plpgsql
as $$
declare
  r record;
  v_counter_trip integer := 0;
  v_counter_fwd  integer := 0;
  v_mode text;
  v_eligible boolean;
begin
  -- Двухфазная схема: сначала временные значения, потом финальные.
  -- Временный номер содержит ТОЛЬКО цифры в диапазоне int
  -- (uuid в номере давал переполнение integer в индексе).
  update public.trips
     set trip_number = '~0'
   where trip_number is not null;

  for r in
    select t.id,
           t.start_date,
           t.end_date,
           t.load_date,
           t.unload_date,
           t.created_at,
           t.profit_mode,
           exists (
             select 1 from public.trip_segments s
              where s.trip_id = t.id
                and s.executor_type = 'us'
                and s.truck_id is not null
                and s.driver_id is not null
           ) as has_us,
           exists (
             select 1 from public.trip_segments s
              where s.trip_id = t.id
                and s.executor_type = 'contractor'
                and s.contractor_id is not null
           ) as has_contractor
      from public.trips t
     order by case when coalesce(t.profit_mode, 'trip') = 'forwarding'
                    then coalesce(t.unload_date, t.load_date)
                    else coalesce(t.end_date, t.start_date) end asc nulls last,
              t.created_at asc,
              t.id asc
  loop
    v_mode := case when r.profit_mode = 'forwarding' then 'forwarding' else 'trip' end;

    -- Заказ получает номер, только если назначен исполнитель.
    if v_mode = 'forwarding' then
      v_eligible := r.has_contractor;
    else
      v_eligible := r.has_us;
    end if;

    if not v_eligible then
      update public.trips set trip_number = null where id = r.id;
      continue;
    end if;

    if v_mode = 'forwarding' then
      v_counter_fwd := v_counter_fwd + 1;
      update public.trips
         set trip_number = v_counter_fwd::text || 'Е'
       where id = r.id;
    else
      v_counter_trip := v_counter_trip + 1;
      update public.trips
         set trip_number = v_counter_trip::text
       where id = r.id;
    end if;
  end loop;

  -- Счётчики приводим к фактическому максимуму.
  update public.trip_counter set last_number = v_counter_trip where id = 1;
  update public.trip_counter set last_number = v_counter_fwd  where id = 2;
end;
$$;


-- ---------- 2. Триггер ловит правку даты выгрузки ----------
-- Раньше триггер реагировал только на start_date/load_date/profit_mode,
-- поэтому правка даты финиша или разгрузки номера не перестраивала.
drop trigger if exists trg_trip_renumber on public.trips;
create trigger trg_trip_renumber
after insert or delete or update of start_date, end_date, load_date, unload_date, profit_mode
on public.trips
for each statement
execute function public.trg_trip_renumber();


-- ---------- 3. Перенумерация под новое правило ----------
select public.renumber_all_trips();


-- ============================================================
-- ROLLBACK
-- create or replace function public.renumber_all_trips()
--  returns void language plpgsql as $$
--  declare r record; v_counter_trip integer := 0; v_counter_fwd integer := 0;
--  begin
--    update public.trips set trip_number = '~0' where trip_number is not null;
--    for r in
--      select t.id, t.created_at, t.profit_mode,
--             exists (select 1 from public.trip_segments s where s.trip_id=t.id and s.executor_type='us' and s.truck_id is not null and s.driver_id is not null) as has_us,
--             exists (select 1 from public.trip_segments s where s.trip_id=t.id and s.executor_type='contractor' and s.contractor_id is not null) as has_contractor
--        from public.trips t
--       order by coalesce(t.start_date, t.load_date) asc nulls last, t.created_at asc, t.id asc
--    loop
--      if r.profit_mode = 'forwarding' then
--        if not r.has_contractor then update public.trips set trip_number = null where id=r.id; continue; end if;
--        v_counter_fwd := v_counter_fwd + 1;
--        update public.trips set trip_number = v_counter_fwd::text || 'Е' where id=r.id;
--      else
--        if not r.has_us then update public.trips set trip_number = null where id=r.id; continue; end if;
--        v_counter_trip := v_counter_trip + 1;
--        update public.trips set trip_number = v_counter_trip::text where id=r.id;
--      end if;
--    end loop;
--    update public.trip_counter set last_number = v_counter_trip where id = 1;
--    update public.trip_counter set last_number = v_counter_fwd  where id = 2;
--  end; $$;
--
-- drop trigger if exists trg_trip_renumber on public.trips;
-- create trigger trg_trip_renumber
-- after insert or delete or update of start_date, load_date, profit_mode
-- on public.trips for each statement execute function public.trg_trip_renumber();
--
-- select public.renumber_all_trips();
-- ============================================================
