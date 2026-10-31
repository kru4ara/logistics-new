-- ============================================================
-- 2026-10-31 (часть 3): Синхронизация дат экспедирований и маршрут
--
-- 1. sync_trip_from_segment работала ТОЛЬКО для сегментов с нашей
--    машиной (executor_type='us'). У экспедирований сегмент всегда
--    подрядчик — поэтому дата заказа (load_date/unload_date) из
--    сегмента НИКОГДА не подтягивалась, и даты нельзя было отредактировать.
--    Теперь синхронизация работает и для экспедирований.
--
-- 2. Маршрут экспедирования (точки загрузки/выгрузки) лежит
--    в trip_segments.stops. После переноса forwarding_points стопы
--    оказались пустыми — восстанавливаем из таблицы-источника.
--
-- 3. unload_date экспедиции добирается из сегмента подрядчика.
--
-- Применение: Supabase SQL Editor -> вставить -> Run.
-- Откат: секция ROLLBACK в конце файла.
-- ============================================================


-- ---------- 1. Синхронизация дат заказа из сегмента ----------
-- Условие по profit_mode обязательно: у рейса дата финиша приходит
-- из сегмента с нашей машиной, у экспедиции — из сегмента подрядчика.
create or replace function public.sync_trip_from_segment()
 returns trigger
 language plpgsql
as $$
declare
  v_mode text;
begin
  select coalesce(t.profit_mode, 'trip')
    into v_mode
    from public.trips t
   where t.id = NEW.trip_id;

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

  -- Рейс: даты из участка с нашей машиной.
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
end;
$$;

drop trigger if exists trg_sync_trip_from_segment on public.trip_segments;
create trigger trg_sync_trip_from_segment
after insert or update of truck_id, driver_id, date_from, date_to, executor_type
on public.trip_segments
for each row
execute function public.sync_trip_from_segment();


-- ---------- 2. Маршрут экспедирований: stops из точек груза ----------
-- Формат stops — тот же, что у обычных сегментов рейсов
-- (app/trips/[id]/segment-actions.ts: parseStops):
--   type: 'load' | 'reload' | 'unload' | 'customs'
-- Тип из forwarding_points ('loading'/'unloading') приводим к общему
-- словарю, исходный тип сохраняем в point_type.
update public.trip_segments s
   set stops = coalesce(
     (
       select jsonb_agg(
                jsonb_build_object(
                  'type', case fp.type
                            when 'loading'   then 'load'
                            when 'unloading' then 'unload'
                            else 'reload'
                          end,
                  'point_type', fp.type,
                  'sequence', fp.sequence,
                  'date', fp.date,
                  'loading_number', fp.loading_number,
                  'notes', fp.notes,
                  'company', l.company_name,
                  'city', l.city,
                  'country', l.country,
                  'address', null,
                  'postal_code', null
                )
                order by fp.type, fp.sequence
              )
         from public.forwarding_points fp
         left join public.locations l on l.id = fp.location_id
         where fp.forwarding_id = t.source_forwarding_id
     ),
     s.stops
   )
from public.trips t
where s.trip_id = t.id
  and t.source_forwarding_id is not null
  and s.executor_type = 'contractor'
  and coalesce(jsonb_array_length(coalesce(s.stops, '[]'::jsonb)), 0) = 0;


-- ---------- 3. Даты экспедиции — заполняем ТОЛЬКО пустые ----------
-- Существующие даты не трогаем: они могли быть проставлены вручную
-- и не совпадать с датой сегмента (загрузка у клиента и у подрядчика
-- может отличаться на день).
update public.trips t
   set load_date = s.date_from
  from public.trip_segments s
 where s.trip_id = t.id
   and t.profit_mode = 'forwarding'
   and t.load_date is null
   and s.date_from is not null;

update public.trips t
   set unload_date = s.date_to
  from public.trip_segments s
 where s.trip_id = t.id
   and t.profit_mode = 'forwarding'
   and t.unload_date is null
   and s.date_to is not null;

-- ---------- 3a. Даты из точек груза (если в сегменте их нет) ----------
update public.trips t
   set load_date = fp.date
  from public.forwarding_points fp
 where fp.forwarding_id = t.source_forwarding_id
   and fp.type = 'loading'
   and fp.date is not null
   and t.profit_mode = 'forwarding'
   and t.load_date is null;

update public.trips t
   set unload_date = fp.date
  from public.forwarding_points fp
 where fp.forwarding_id = t.source_forwarding_id
   and fp.type = 'unloading'
   and fp.date is not null
   and t.profit_mode = 'forwarding'
   and t.unload_date is null;


-- ---------- 4. Нумерация после восстановления дат ----------
select public.renumber_all_trips();


-- ============================================================
-- ROLLBACK
-- ============================================================
-- update public.trips t
--    set unload_date = null
--  where t.profit_mode = 'forwarding';
--
-- create or replace function public.sync_trip_from_segment()
--  returns trigger language plpgsql as $$
--  begin
--    if NEW.executor_type = 'us' then
--      update trips
--         set truck_id   = coalesce(NEW.truck_id, truck_id),
--             trailer_id = coalesce(NEW.trailer_id, trailer_id),
--             driver_id  = coalesce(NEW.driver_id, driver_id),
--             start_date = coalesce(NEW.date_from, start_date),
--             end_date   = coalesce(NEW.date_to, end_date)
--       where id = NEW.trip_id;
--    end if;
--    return NEW;
--  end;
--  $$;
