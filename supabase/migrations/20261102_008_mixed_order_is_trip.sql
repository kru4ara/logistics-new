-- Смешанный заказ (наша авто + подрядчик) — это рейс, даже если
-- конкретная машина нашей авто ещё не назначена.
--
-- Раньше derive_profit_mode считал наш транспорт только при полном
-- назначении (машина + водитель). Из-за этого смешанный заказ с
-- неназначенной машиной уходил в экспедирование и получал номер
-- с суффиксом "Е" вместо обычного номера рейса.
--
-- Правка синхронизирована с кодом приложения:
--   lib/orders-core.ts -> deriveProfitMode, hasAssignedExecutor.

create or replace function public.derive_profit_mode(p_trip_id uuid)
returns text
language plpgsql
as $$
declare
  v_has_us boolean;       -- есть сегмент "наша авто" (любое назначение)
  v_has_us_full boolean;  -- наша авто назначена полностью: машина + водитель
  v_has_contractor boolean;
begin
  select
    exists (select 1 from public.trip_segments s
             where s.trip_id = p_trip_id and s.executor_type = 'us'),
    exists (select 1 from public.trip_segments s
             where s.trip_id = p_trip_id and s.executor_type = 'us'
               and s.truck_id is not null and s.driver_id is not null),
    exists (select 1 from public.trip_segments s
             where s.trip_id = p_trip_id and s.executor_type = 'contractor'
               and s.contractor_id is not null)
    into v_has_us, v_has_us_full, v_has_contractor;

  -- Смешанный заказ (подрядчик + наша авто) — рейс, а не экспедиция.
  if v_has_us and (v_has_us_full or v_has_contractor) then return 'trip'; end if;
  if v_has_us_full then return 'trip'; end if;
  if v_has_contractor then return 'forwarding'; end if;
  return null;
end;
$$;

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
           ) as has_us,
           exists (
             select 1 from public.trip_segments s
              where s.trip_id = t.id
                and s.executor_type = 'us'
                and s.truck_id is not null
                and s.driver_id is not null
           ) as has_us_full,
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

-- Пересчитываем режимы и номера под новое правило.
update public.trips t
   set profit_mode = public.derive_profit_mode(t.id)
 where t.profit_mode is distinct from public.derive_profit_mode(t.id);

select public.renumber_all_trips();
