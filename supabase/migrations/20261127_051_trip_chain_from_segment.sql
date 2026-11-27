-- 051: цепочка дат машины срабатывает и когда машину ставят через участок.
--
-- В 046 триггер trg_trip_chain пропускал любые вложенные обновления
-- (pg_trigger_depth() > 1), чтобы не перезапускаться от своих же правок.
-- Но машину на заказ обычно ставят участком «Мы»: trip_segments →
-- sync_trip_from_segment → update trips — это тоже глубина 2, и старт
-- нового рейса не подставлялся (рейс №88, 27.11.2026).
-- Теперь свои правки цепочка помечает флагом сессии app.trip_chain, а
-- остальные вложенные обновления обрабатываются как обычные.
-- Плюс разовая подстановка старта заказам нашей машины, у которых его нет.
-- Только create or replace и обновление пустых start_date.

begin;

create or replace function public.apply_trip_chain(p_trip_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  t public.trips;
  v_prev_end date;
  v_start timestamp;
begin
  select * into t from public.trips where id = p_trip_id;
  if not found or not public.trip_is_own(t) or t.chain_exempt then return; end if;

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
  -- Своя правка: триггер цепочки на неё не реагирует (флаг до конца этого update).
  perform set_config('app.trip_chain', 'on', true);
  update public.trips set start_date = v_start
   where id = t.id and start_date is distinct from v_start;
  perform set_config('app.trip_chain', 'off', true);
end;
$$;

create or replace function public.trg_trip_chain() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Свои же обновления (из apply_trip_chain) цепочку не перезапускают.
  if coalesce(current_setting('app.trip_chain', true), '') = 'on' then return null; end if;

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

-- Заказы нашей машины без старта (машину поставили участком до этой миграции).
select public.apply_trip_chain(t.id)
  from public.trips t
 where t.start_date is null and t.truck_id is not null
   and t.profit_mode is distinct from 'forwarding'
   and t.status is distinct from 'cancelled'
   and not coalesce(t.chain_exempt, false);

commit;
