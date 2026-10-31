-- ============================================================
-- 2026-11-01 (часть 5): Нумерация по дате ВЫГРУЗКИ — строго
--
-- Правило:
--   номер заказа растёт по возрастанию даты ВЫГРУЗКИ:
--     рейс       -> end_date   (финиш)
--     экспедиция -> unload_date (разгрузка)
--   Запасного варианта НЕТ: start_date/load_date не подставляются.
--
--   Заказ без даты выгрузки (в пути) идёт в КОНЕЦ своей ветки
--   и получает наибольший номер — так он никогда не обгоняет
--   завершённые заказы.
--
-- Ветки нумерации независимы:
--   рейс        -> '42'
--   экспедиция -> '42Е'
--
-- Применение: Supabase SQL Editor -> вставить -> Run.
-- Откат: секция ROLLBACK в конце файла.
-- ============================================================


-- ---------- 1. Нумерация по дате выгрузки (строго) ----------
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
                    then t.unload_date
                    else t.end_date end asc nulls last,
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


-- ---------- 2. Перенумерация под новое правило ----------
-- Вызывается в конце: функция пересобирает все номера сразу.
select public.renumber_all_trips();


-- ============================================================
-- ROLLBACK (выполнять вручную, если нужно вернуть старое правило)
-- ============================================================
-- create or replace function public.renumber_all_trips()
--  returns void
--  language plpgsql
--  as $$
--  ... версия с coalesce(unload_date, load_date) / coalesce(end_date, start_date) ...
--  $$;
