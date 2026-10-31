-- ============================================================
-- 2026-10-31: Перенос экспедирований в заказы
--
-- forwarding_orders      -> trips (profit_mode='forwarding')
-- forwarding_contractors -> trip_segments (executor_type='contractor')
-- forwarding_expenses    -> trip_expenses
-- forwarding_points      -> trip_segments.stops (jsonb)
--
-- Перенос выполняется ОДИН РАЗ и идемпотентен: повторный запуск
-- ничего не дублирует, потому что source_forwarding_id уникален.
-- ============================================================

-- ---------- 0. Связь со старой таблицей ----------
-- Колонка нужна для идемпотентности и для отката.
alter table public.trips
  add column if not exists source_forwarding_id uuid;

create unique index if not exists idx_trips_source_forwarding_id
  on public.trips (source_forwarding_id)
  where source_forwarding_id is not null;

-- ---------- 1. Заказы ----------
insert into public.trips (
  client_id,
  revenue_eur,
  status,
  start_date,
  end_date,
  profit_mode,
  is_forwarding,
  load_date,
  unload_date,
  costs_closed,
  client_request_number,
  client_request_date,
  created_at,
  source_forwarding_id
)
select
  fo.client_id,
  coalesce(fo.client_price_eur, 0),
  fo.status,
  null,
  null,
  'forwarding',
  true,
  fo.load_date,
  fo.unload_date,
  case when fo.status in ('paid', 'invoiced') then true else false end,
  fo.client_request_number,
  fo.client_request_date,
  fo.created_at,
  fo.id
from public.forwarding_orders fo
where not exists (
  select 1 from public.trips t where t.source_forwarding_id = fo.id
);

-- ---------- 2. Подрядчики -> сегменты ----------
-- executor_type='contractor': у подрядчика нет нашего транспорта,
-- но номер заказа экспедиции ему не нужен — номер у заказа.
insert into public.trip_segments (
  trip_id,
  position,
  executor_type,
  contractor_id,
  date_from,
  date_to,
  price,
  currency,
  contractor_truck_number,
  contractor_driver_name,
  contractor_payment_days,
  contractor_transport_type,
  contractor_transport_temperature,
  notes,
  created_at
)
select
  t.id,
  coalesce(fc.position, 1),
  'contractor',
  fc.contractor_id,
  fo.load_date,
  fo.unload_date,
  coalesce(fc.price_eur, 0),
  coalesce(fc.currency, 'EUR'),
  fc.truck_number,
  fc.driver_name,
  fc.payment_days,
  fo.transport_type,
  fo.transport_temperature,
  fc.notes,
  fc.created_at
from public.forwarding_contractors fc
join public.forwarding_orders fo on fo.id = fc.forwarding_id
join public.trips t on t.source_forwarding_id = fo.id
where not exists (
  select 1
  from public.trip_segments s
  where s.trip_id = t.id
    and s.executor_type = 'contractor'
    and s.contractor_id = fc.contractor_id
    and s.position = coalesce(fc.position, 1)
);

-- ---------- 3. Точки (загрузка/выгрузка) -> stops сегмента ----------
-- Формат stops — тот же, что у обычных сегментов рейсов
-- (app/trips/[id]/segment-actions.ts: parseStops):
--   type: 'load' | 'reload' | 'unload' | 'customs'
--   company / country / city / address / postal_code / date
-- Тип из forwarding_points ('loading' / 'unloading') приводим
-- к общему словарю, исходный тип сохраняем в point_type.
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
  and s.executor_type = 'contractor';

-- ---------- 4. Доп. расходы экспедиции -> расходы заказа ----------
insert into public.trip_expenses (
  trip_id,
  category,
  amount_eur,
  currency,
  description,
  expense_date,
  created_at
)
select
  t.id,
  coalesce(fe.category, 'forwarding'),
  coalesce(fe.amount_eur, 0),
  coalesce(fe.currency, 'EUR'),
  fe.description,
  fe.expense_date,
  fe.created_at
from public.forwarding_expenses fe
join public.trips t on t.source_forwarding_id = fe.forwarding_id
where not exists (
  select 1
  from public.trip_expenses e
  where e.trip_id = t.id
    and e.category = coalesce(fe.category, 'forwarding')
    and e.expense_date is not distinct from fe.expense_date
    and e.amount_eur = fe.amount_eur
);

-- ---------- 5. Перенумерация ----------
-- После переноса у экспедиций появились подрядчики, значит
-- заказы получают номера «1Е..NЕ».
select public.renumber_all_trips();
