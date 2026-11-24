-- 047: исключение из цепочки машины (046). Два рейса одной машины, которые шли
-- одновременно (сборный груз двух клиентов до того, как CRM умела сборные заказы), —
-- офис отмечает «оставить как есть»: старт такого рейса база больше не трогает,
-- а список «Дыры между рейсами» его не показывает. Только добавление.

begin;

alter table public.trips add column if not exists chain_exempt boolean not null default false;

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

revoke all on function public.apply_trip_chain(uuid) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.apply_trip_chain(uuid) to service_role;
  end if;
end $$;

commit;
