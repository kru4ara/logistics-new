-- 048: сборный рейс — несколько заказов (по клиенту на заказ, со своей фактурой и оплатой)
-- в одной машине. Ведущий заказ везёт: у него машина, водитель, участки и расходы.
-- Остальные заказы группы — только клиент, груз, фрахт и фактура; trips.group_id = id
-- ведущего (у самого ведущего group_id = его id). Даты рейса у группы общие: база
-- копирует старт и финиш ведущего в заказы группы (выручка попадает в тот же месяц).
-- Заказы группы без машины — в цепочку машины (046) и отчёты GPS не входят.
-- Только добавление.

begin;

alter table public.trips add column if not exists group_id uuid references public.trips (id) on delete set null;
create index if not exists trips_group_idx on public.trips (group_id) where group_id is not null;

create or replace function public.trg_trip_group_dates() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.group_id is null then return null; end if;
  if new.group_id = new.id then
    -- ведущий: даты — в заказы группы
    update public.trips
       set start_date = new.start_date, end_date = new.end_date
     where group_id = new.id and id <> new.id
       and (start_date is distinct from new.start_date or end_date is distinct from new.end_date);
  elsif tg_op = 'INSERT' or old.group_id is distinct from new.group_id then
    -- заказ вошёл в группу: даты — от ведущего
    update public.trips m
       set start_date = l.start_date, end_date = l.end_date
      from public.trips l
     where m.id = new.id and l.id = new.group_id
       and (m.start_date is distinct from l.start_date or m.end_date is distinct from l.end_date);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_trip_group_dates on public.trips;
create trigger trg_trip_group_dates
  after insert or update of group_id, start_date, end_date on public.trips
  for each row execute function public.trg_trip_group_dates();

commit;
