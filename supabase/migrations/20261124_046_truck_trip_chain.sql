-- 046: рейсы одной нашей машины идут цепочкой, без дыр: старт рейса = следующий день
-- после финиша предыдущего рейса этой машины. Правило живёт в базе (как владение рейсом):
-- оно держится, кто бы ни менял даты — офис, водитель кнопкой «Начать», импорт.
--
-- Предыдущий рейс — рейс той же машины (свой, не экспедиция, не отменён) с самым поздним
-- финишем, не позже финиша этого рейса. Нет предыдущего или он ещё не завершён —
-- старт не трогаем. Старт не может оказаться позже финиша самого рейса.
--
-- Строго, но точечно: пересчитывается рейс, который меняют, и следующий за ним (когда
-- меняется финиш, машина или рейс удалён). Старые дыры в истории сами не закрываются —
-- их показывает «Рейсы → Дыры между рейсами», закрываются кнопкой (apply_trip_chain).
-- Только добавление функций и триггеров.

begin;

create or replace function public.trip_is_own(p_trip public.trips) returns boolean
language sql immutable as $$
  select p_trip.truck_id is not null
     and p_trip.profit_mode is distinct from 'forwarding'
     and p_trip.status is distinct from 'cancelled';
$$;

-- Применить правило к одному рейсу: старт = финиш предыдущего + 1 день.
create or replace function public.apply_trip_chain(p_trip_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  t public.trips;
  v_prev_end date;
  v_start timestamp;
begin
  select * into t from public.trips where id = p_trip_id;
  if not found or not public.trip_is_own(t) then return; end if;

  select max(p.end_date::date) into v_prev_end
    from public.trips p
   where p.truck_id = t.truck_id
     and p.id <> t.id
     and p.end_date is not null
     and p.profit_mode is distinct from 'forwarding'
     and p.status is distinct from 'cancelled'
     and (t.end_date is null or p.end_date::date <= t.end_date::date)
     -- рейс, начатый после этого, — не предыдущий (иначе два рейса одного дня зацикливаются)
     and (t.start_date is null or p.start_date is null or p.start_date <= t.start_date or p.end_date::date < t.end_date::date);

  if v_prev_end is null then return; end if;
  v_start := (v_prev_end + 1)::timestamp;
  if t.end_date is not null and v_start > t.end_date then
    v_start := t.end_date::date::timestamp;
  end if;
  update public.trips set start_date = v_start
   where id = t.id and start_date is distinct from v_start;
end;
$$;

-- Следующий рейс машины после даты финиша.
create or replace function public.next_truck_trip(p_truck uuid, p_after date, p_exclude uuid) returns uuid
language sql stable as $$
  select n.id
    from public.trips n
   where n.truck_id = p_truck
     and n.id <> p_exclude
     and n.profit_mode is distinct from 'forwarding'
     and n.status is distinct from 'cancelled'
     and (n.end_date is null or n.end_date::date > p_after)
   order by n.end_date nulls last, n.start_date nulls last, n.created_at
   limit 1;
$$;

create or replace function public.trg_trip_chain() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Свои же обновления (из apply_trip_chain) цепочку не перезапускают.
  if pg_trigger_depth() > 1 then return null; end if;

  if tg_op = 'DELETE' then
    if old.truck_id is not null and old.end_date is not null then
      perform public.apply_trip_chain(public.next_truck_trip(old.truck_id, old.end_date::date, old.id));
    end if;
    return null;
  end if;

  -- Сам рейс — когда его создают или меняют машину / даты (смена статуса «оплачен»
  -- старую дыру не закрывает: старые дыры закрываются кнопкой).
  if tg_op = 'INSERT' or old.truck_id is distinct from new.truck_id or old.start_date is distinct from new.start_date
     or old.end_date is distinct from new.end_date or old.profit_mode is distinct from new.profit_mode then
    perform public.apply_trip_chain(new.id);
  end if;

  if new.end_date is not null and new.truck_id is not null
     and (tg_op = 'INSERT' or old.end_date is distinct from new.end_date or old.truck_id is distinct from new.truck_id
          or (old.status is distinct from new.status and 'cancelled' in (old.status, new.status))) then
    perform public.apply_trip_chain(public.next_truck_trip(new.truck_id, new.end_date::date, new.id));
  end if;
  -- Машину сняли с рейса — у старой машины следующий рейс теперь цепляется к другому.
  if tg_op = 'UPDATE' and old.truck_id is not null and old.truck_id is distinct from new.truck_id and old.end_date is not null then
    perform public.apply_trip_chain(public.next_truck_trip(old.truck_id, old.end_date::date, old.id));
  end if;
  return null;
end;
$$;

drop trigger if exists trg_trip_chain on public.trips;
create trigger trg_trip_chain
  after insert or delete or update of truck_id, start_date, end_date, status, profit_mode
  on public.trips
  for each row execute function public.trg_trip_chain();

revoke all on function public.apply_trip_chain(uuid) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.apply_trip_chain(uuid) to service_role;
  end if;
end $$;

commit;
