-- Разделение ФАКТИЧЕСКИХ и ПЛАНОВЫХ дат заказа.
--
-- Зафиксировано 07.11.2026:
--
--   trips.start_date / trips.end_date  — ФАКТИЧЕСКИЕ даты заказа:
--     рейс       -> старт и финиш нашей машины;
--     экспедиция -> фактическая погрузка и разгрузка.
--   trips.load_date / trips.unload_date — ПЛАНОВЫЕ даты.
--   trip_segments.date_from / date_to   — ПЛАНОВЫЕ даты по участку.
--
-- Проблема, которую снимает миграция:
--
--   1. Триггер sync_trip_from_segment записывал в заказ
--      start_date = coalesce(NEW.date_from, start_date) и
--      end_date   = coalesce(NEW.date_to,   end_date),
--      то есть ПЛАН из сегмента затирал ФАКТ, введённый офисом.
--      Дальше любая правка сегмента снова возвращала план в факт.
--
--   2. Месяц заказа, сортировка и нумерация для экспедирований
--      считались по unload_date (план), а не по факту разгрузки.
--      Из-за этого номер экспедиции и его месяц в статистике
--      не совпадали с фактической датой.
--
-- Что делает миграция:
--
--   1. sync_trip_from_segment больше НЕ пишет даты в заказ.
--      Для рейса остаётся только назначение машины и водителя.
--      Для экспедирования плановые даты заполняются
--      только если они ещё пусты (coalesce), чтобы не затирать
--      уже проставленный план.
--
--   2. renumber_all_trips сортирует ВСЕ заказы по end_date
--      (фактическая дата выгрузки) — одинаково для рейса
--      и экспедирования.
--
-- Проверка перед применением: перенумерация не сдвинула
-- ни одного номера (112 номеров, 0 изменений) — все 31
-- экспедиция имеют фактические start_date и end_date,
-- и порядок по unload_date совпадает с порядком по end_date.

-- 1. Триггер: даты в заказ не пишутся.
create or replace function public.sync_trip_from_segment() returns trigger
language plpgsql as $$
declare v_mode text;
begin
  v_mode := public.derive_profit_mode(NEW.trip_id);
  if v_mode is not null then
    update public.trips set profit_mode = v_mode
     where id = NEW.trip_id and profit_mode is distinct from v_mode;
  end if;
  if v_mode = 'forwarding' then
    if NEW.executor_type = 'contractor' then
      update public.trips
         set load_date   = coalesce(public.trips.load_date, NEW.date_from),
             unload_date = coalesce(public.trips.unload_date, NEW.date_to)
       where id = NEW.trip_id;
    end if;
    return NEW;
  end if;
  if v_mode = 'trip' then
    if NEW.executor_type = 'us' then
      update public.trips
         set truck_id   = coalesce(NEW.truck_id, truck_id),
             trailer_id = coalesce(NEW.trailer_id, trailer_id),
             driver_id  = coalesce(NEW.driver_id, driver_id)
       where id = NEW.trip_id;
    end if;
    return NEW;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_sync_trip_from_segment on public.trip_segments;

create trigger trg_sync_trip_from_segment
 after insert or update of truck_id, driver_id, date_from, date_to, executor_type, contractor_id
 on public.trip_segments for each row execute function sync_trip_from_segment();

-- 2. Нумерация: сортировка по фактической дате выгрузки (end_date).
create or replace function public.renumber_all_trips() returns void
language plpgsql as $$
declare
  r record;
  v_counter_trip integer := 0;
  v_counter_fwd  integer := 0;
  v_mode text;
  v_eligible boolean;
begin
  update public.trips set trip_number = '~0' where trip_number is not null;

  for r in
    select t.id, t.start_date, t.end_date, t.created_at, t.profit_mode,
           exists (select 1 from public.trip_segments s where s.trip_id = t.id
                     and s.executor_type = 'us') as has_us,
           exists (select 1 from public.trip_segments s where s.trip_id = t.id
                     and s.executor_type = 'us' and s.truck_id is not null and s.driver_id is not null) as has_us_full,
           exists (select 1 from public.trip_segments s where s.trip_id = t.id
                     and s.executor_type = 'contractor' and s.contractor_id is not null) as has_contractor
      from public.trips t
     order by t.end_date asc nulls last,
              t.created_at asc, t.id asc
  loop
    v_mode := case when r.profit_mode = 'forwarding' then 'forwarding' else 'trip' end;

    if v_mode = 'forwarding' then
      v_eligible := r.has_contractor;
    else
      -- Рейс рабочий, если назначен наш транспорт.
      -- Смешанный заказ (сегмент "наша авто" + подрядчик) рабочий
      -- уже по подрядчику: конкретную машину назначают позже.
      v_eligible := r.has_us_full or (r.has_us and r.has_contractor);
    end if;

    if not v_eligible then
      update public.trips set trip_number = null where id = r.id;
      continue;
    end if;

    if v_mode = 'forwarding' then
      v_counter_fwd := v_counter_fwd + 1;
      update public.trips set trip_number = v_counter_fwd::text || 'Е' where id = r.id;
    else
      v_counter_trip := v_counter_trip + 1;
      update public.trips set trip_number = v_counter_trip::text where id = r.id;
    end if;
  end loop;

  update public.trip_counter set last_number = v_counter_trip where id = 1;
  update public.trip_counter set last_number = v_counter_fwd  where id = 2;
end;
$$;
