-- ============================================================
-- 2026-10-31: Единая модель заказа (рейсы + экспедирование)
--
-- 1. Новые колонки в trips: profit_mode, is_forwarding,
--    load_date, unload_date, costs_closed.
-- 2. trip_number: integer -> text (нужен суффикс «Е»).
-- 3. Перенумерация в двух ветках: рейсы «1..N», экспедиции «1Е..NЕ».
--    Ветки независимы, нумерация плотная, без дыр.
-- 4. Годовые общие затраты падают целиком в месяц оплаты.
-- ============================================================

-- ---------- 1. Новые колонки ----------

alter table public.trips
  add column if not exists profit_mode   text,
  add column if not exists is_forwarding boolean,
  add column if not exists load_date     date,
  add column if not exists unload_date   date,
  add column if not exists costs_closed  boolean;

update public.trips
   set profit_mode   = coalesce(profit_mode, 'trip'),
       is_forwarding = coalesce(is_forwarding, false),
       costs_closed  = coalesce(costs_closed, false)
 where profit_mode is null
    or is_forwarding is null
    or costs_closed is null;

alter table public.trips
  alter column profit_mode  set default 'trip',
  alter column profit_mode  set not null,
  alter column is_forwarding set default false,
  alter column is_forwarding set not null,
  alter column costs_closed  set default false;

-- Проверка допустимых значений режима расчёта.
alter table public.trips
  drop constraint if exists trips_profit_mode_check;
alter table public.trips
  add constraint trips_profit_mode_check
  check (profit_mode in ('trip', 'forwarding'));

-- ---------- 2. Номер заказа: integer -> text ----------

-- Значения становятся текстовыми ('42'), чтобы появился суффикс «Е».
alter table public.trips
  alter column trip_number type text using trip_number::text;

-- ---------- 3. Бэкфилл costs_closed ----------
-- Исторические завершённые заказы считаем со сведёнными расходами:
-- иначе статистика после переключения опустеет.
update public.trips
   set costs_closed = true
 where status in ('paid', 'invoiced');

-- ---------- 4. Счётчик под две ветки нумерации ----------
-- trip_counter: id = 1 (рейсы), id = 2 (экспедиции).
create table if not exists public.trip_counter (
  id          integer primary key,
  last_number integer not null default 0
);

insert into public.trip_counter (id, last_number)
values (1, 0), (2, 0)
on conflict (id) do update set last_number = greatest(
  public.trip_counter.last_number,
  excluded.last_number
);

-- ---------- 5. Перенумерация в двух ветках ----------

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
  -- Временный номер содержит ТОЛЬКО цифры в диапазоне int.
  -- Раньше здесь был '~' || id::text — uuid даёт 19-значное число,
  -- и индекс ((regexp_replace(trip_number,'[^0-9]','','g'))::integer)
  -- падал с ошибкой переполнения integer.
  update public.trips
     set trip_number = '~0'
   where trip_number is not null;

  for r in
    select t.id,
           t.start_date,
           t.load_date,
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
     order by coalesce(t.start_date, t.load_date) asc nulls last,
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

-- ---------- 6. Триггеры ----------
-- Перенумерация теперь учитывает и дату загрузки экспедиции,
-- и смену режима расчёта.
drop trigger if exists trg_trip_renumber on public.trips;
drop trigger if exists trg_segment_renumber on public.trip_segments;

create trigger trg_trip_renumber
after insert or delete or update of start_date, load_date, profit_mode
on public.trips
for each statement
execute function public.renumber_all_trips();

create trigger trg_segment_renumber
after insert or delete or update
on public.trip_segments
for each statement
execute function public.renumber_all_trips();

-- ---------- 7. Сортировка по номеру — числовая ----------
-- trip_number теперь текстовый, поэтому обычный orderBy дал бы
-- «10» перед «2». Индекс по числовой части.
create index if not exists idx_trips_trip_number_num
  on public.trips (((regexp_replace(trip_number, '[^0-9]', '', 'g'))::int))
  where trip_number is not null;

-- ---------- 8. Годовые общие затраты — целиком в месяц оплаты ----------
-- Раньше годовая сумма делилась на 12 и размазывалась по месяцам.
-- Теперь она целиком попадает в месяц оплаты.
create or replace function public.fixed_costs_by_month(p_year integer)
 returns table (month_key text, amount numeric)
 language plpgsql
 stable
as $$
begin
  return query
    select fc.month_key,
           sum(fc.amount_eur) as amount
      from public.fixed_costs fc
     where fc.month_key is not null
       and fc.month_key like p_year::text || '-%'
       and fc.is_capex is not true
       and fc.amount_eur is not null
       and fc.amount_eur <> 0
     group by fc.month_key
     order by fc.month_key;
end;
$$;
