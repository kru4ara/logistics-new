-- ============================================================
-- Фаза 32 (часть 2) — RLS на остальных таблицах
-- ============================================================
-- Применять ПОСЛЕ файла 001 (там создаются public.is_office() и
-- public.current_driver_id()).
--
-- Здесь же — функция поиска e-mail для логина. login/actions.ts ищет
-- пользователя по логину ДО авторизации. Прямой SELECT из users/drivers
-- под anon-ключом — это и есть утечка: ключ публичный, лежит в
-- клиентском бандле, читать мог кто угодно из интернета. Поэтому поиск
-- уезжает в security-definer функцию: она читает таблицу от имени
-- владельца, но возвращает только e-mail.
-- ============================================================


-- ============================================================
-- 0. Поиск e-mail для логина (вызывается ДО входа)
-- ============================================================

create or replace function public.lookup_login_email(p_login text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if p_login is null or btrim(p_login) = '' then
    return null;
  end if;

  select u.email into v_email
  from public.users u
  where lower(btrim(u.login)) = lower(btrim(p_login))
  limit 1;

  if v_email is not null then
    return v_email;
  end if;

  select d.email into v_email
  from public.drivers d
  where lower(d.last_name) = lower(btrim(p_login))
  limit 1;

  return v_email;
end;
$$;

revoke all on function public.lookup_login_email(text) from public;
grant execute on function public.lookup_login_email(text) to anon, authenticated;

-- clients: только офис. Приложение ходит сюда через service_role,
-- который RLS обходит, поэтому поведение приложения не меняется.
alter table public.clients enable row level security;

drop policy if exists clients_office_select on public.clients;
create policy clients_office_select on public.clients
  for select to authenticated
  using (public.is_office());

drop policy if exists clients_office_write on public.clients;
create policy clients_office_write on public.clients
  for all to authenticated
  using (public.is_office())
  with check (public.is_office());

-- contractors: только офис. Приложение ходит сюда через service_role,
-- который RLS обходит, поэтому поведение приложения не меняется.
alter table public.contractors enable row level security;

drop policy if exists contractors_office_select on public.contractors;
create policy contractors_office_select on public.contractors
  for select to authenticated
  using (public.is_office());

drop policy if exists contractors_office_write on public.contractors;
create policy contractors_office_write on public.contractors
  for all to authenticated
  using (public.is_office())
  with check (public.is_office());

-- locations: только офис. Приложение ходит сюда через service_role,
-- который RLS обходит, поэтому поведение приложения не меняется.
alter table public.locations enable row level security;

drop policy if exists locations_office_select on public.locations;
create policy locations_office_select on public.locations
  for select to authenticated
  using (public.is_office());

drop policy if exists locations_office_write on public.locations;
create policy locations_office_write on public.locations
  for all to authenticated
  using (public.is_office())
  with check (public.is_office());

-- fixed_costs: только офис. Приложение ходит сюда через service_role,
-- который RLS обходит, поэтому поведение приложения не меняется.
alter table public.fixed_costs enable row level security;

drop policy if exists fixed_costs_office_select on public.fixed_costs;
create policy fixed_costs_office_select on public.fixed_costs
  for select to authenticated
  using (public.is_office());

drop policy if exists fixed_costs_office_write on public.fixed_costs;
create policy fixed_costs_office_write on public.fixed_costs
  for all to authenticated
  using (public.is_office())
  with check (public.is_office());

-- audit_log: только офис. Приложение ходит сюда через service_role,
-- который RLS обходит, поэтому поведение приложения не меняется.
alter table public.audit_log enable row level security;

drop policy if exists audit_log_office_select on public.audit_log;
create policy audit_log_office_select on public.audit_log
  for select to authenticated
  using (public.is_office());

drop policy if exists audit_log_office_write on public.audit_log;
create policy audit_log_office_write on public.audit_log
  for all to authenticated
  using (public.is_office())
  with check (public.is_office());

-- forwarding_orders: только офис. Приложение ходит сюда через service_role,
-- который RLS обходит, поэтому поведение приложения не меняется.
alter table public.forwarding_orders enable row level security;

drop policy if exists forwarding_orders_office_select on public.forwarding_orders;
create policy forwarding_orders_office_select on public.forwarding_orders
  for select to authenticated
  using (public.is_office());

drop policy if exists forwarding_orders_office_write on public.forwarding_orders;
create policy forwarding_orders_office_write on public.forwarding_orders
  for all to authenticated
  using (public.is_office())
  with check (public.is_office());

-- forwarding_contractors: только офис. Приложение ходит сюда через service_role,
-- который RLS обходит, поэтому поведение приложения не меняется.
alter table public.forwarding_contractors enable row level security;

drop policy if exists forwarding_contractors_office_select on public.forwarding_contractors;
create policy forwarding_contractors_office_select on public.forwarding_contractors
  for select to authenticated
  using (public.is_office());

drop policy if exists forwarding_contractors_office_write on public.forwarding_contractors;
create policy forwarding_contractors_office_write on public.forwarding_contractors
  for all to authenticated
  using (public.is_office())
  with check (public.is_office());

-- forwarding_expenses: только офис. Приложение ходит сюда через service_role,
-- который RLS обходит, поэтому поведение приложения не меняется.
alter table public.forwarding_expenses enable row level security;

drop policy if exists forwarding_expenses_office_select on public.forwarding_expenses;
create policy forwarding_expenses_office_select on public.forwarding_expenses
  for select to authenticated
  using (public.is_office());

drop policy if exists forwarding_expenses_office_write on public.forwarding_expenses;
create policy forwarding_expenses_office_write on public.forwarding_expenses
  for all to authenticated
  using (public.is_office())
  with check (public.is_office());

-- forwarding_points: только офис. Приложение ходит сюда через service_role,
-- который RLS обходит, поэтому поведение приложения не меняется.
alter table public.forwarding_points enable row level security;

drop policy if exists forwarding_points_office_select on public.forwarding_points;
create policy forwarding_points_office_select on public.forwarding_points
  for select to authenticated
  using (public.is_office());

drop policy if exists forwarding_points_office_write on public.forwarding_points;
create policy forwarding_points_office_write on public.forwarding_points
  for all to authenticated
  using (public.is_office())
  with check (public.is_office());

-- ============================================================
-- Спец-таблицы: у водителя есть свой доступ
-- ============================================================

-- drivers: водитель читает только себя, офис — всех.
alter table public.drivers enable row level security;

drop policy if exists drivers_select_own_or_office on public.drivers;
create policy drivers_select_own_or_office on public.drivers
  for select to authenticated
  using (
    public.is_office()
    or id = public.current_driver_id()
  );

drop policy if exists drivers_office_write on public.drivers;
create policy drivers_office_write on public.drivers
  for all to authenticated
  using (public.is_office())
  with check (public.is_office());

-- users: логин/пароли офиса. Читает только офис.
alter table public.users enable row level security;

drop policy if exists users_office_select on public.users;
create policy users_office_select on public.users
  for select to authenticated
  using (public.is_office());

drop policy if exists users_office_write on public.users;
create policy users_office_write on public.users
  for all to authenticated
  using (public.is_office())
  with check (public.is_office());

-- driver_transactions: расчёты с водителем — только свой.
alter table public.driver_transactions enable row level security;

drop policy if exists driver_transactions_select_own_or_office on public.driver_transactions;
create policy driver_transactions_select_own_or_office on public.driver_transactions
  for select to authenticated
  using (
    public.is_office()
    or driver_id = public.current_driver_id()
  );

drop policy if exists driver_transactions_office_write on public.driver_transactions;
create policy driver_transactions_office_write on public.driver_transactions
  for all to authenticated
  using (public.is_office())
  with check (public.is_office());

-- trip_cargo: груз рейса.
alter table public.trip_cargo enable row level security;

drop policy if exists trip_cargo_select_own_or_office on public.trip_cargo;
create policy trip_cargo_select_own_or_office on public.trip_cargo
  for select to authenticated
  using (
    public.is_office()
    or exists (
      select 1 from public.trips t
      where t.id = trip_cargo.trip_id
        and t.driver_id = public.current_driver_id()
    )
  );

drop policy if exists trip_cargo_office_write on public.trip_cargo;
create policy trip_cargo_office_write on public.trip_cargo
  for all to authenticated
  using (public.is_office())
  with check (public.is_office());

-- trip_segment_cargo: груз по сегменту рейса.
alter table public.trip_segment_cargo enable row level security;

drop policy if exists trip_segment_cargo_select_own_or_office on public.trip_segment_cargo;
create policy trip_segment_cargo_select_own_or_office on public.trip_segment_cargo
  for select to authenticated
  using (
    public.is_office()
    or exists (
      select 1 from public.trips t
      join public.trip_segments s on s.trip_id = t.id
      where s.id = trip_segment_cargo.segment_id
        and t.driver_id = public.current_driver_id()
    )
  );

drop policy if exists trip_segment_cargo_office_write on public.trip_segment_cargo;
create policy trip_segment_cargo_office_write on public.trip_segment_cargo
  for all to authenticated
  using (public.is_office())
  with check (public.is_office());

-- trip_documents: документы рейса.
alter table public.trip_documents enable row level security;

drop policy if exists trip_documents_select_own_or_office on public.trip_documents;
create policy trip_documents_select_own_or_office on public.trip_documents
  for select to authenticated
  using (
    public.is_office()
    or exists (
      select 1 from public.trips t
      where t.id = trip_documents.trip_id
        and t.driver_id = public.current_driver_id()
    )
  );

drop policy if exists trip_documents_office_write on public.trip_documents;
create policy trip_documents_office_write on public.trip_documents
  for all to authenticated
  using (public.is_office())
  with check (public.is_office());

-- documents: файлы водителей (паспорта, права) — свои + офис.
alter table public.documents enable row level security;

drop policy if exists documents_select_own_or_office on public.documents;
create policy documents_select_own_or_office on public.documents
  for select to authenticated
  using (
    public.is_office()
    or exists (
      select 1 from public.drivers d
      where d.id = documents.entity_id
        and d.id = public.current_driver_id()
    )
  );

drop policy if exists documents_office_write on public.documents;
create policy documents_office_write on public.documents
  for all to authenticated
  using (public.is_office())
  with check (public.is_office());

-- trucks: по решению владельца Logisat доступен для ВСЕХ машин,
-- поэтому читать trucks могут и водитель, и офис.
alter table public.trucks enable row level security;

drop policy if exists trucks_select_authenticated on public.trucks;
create policy trucks_select_authenticated on public.trucks
  for select to authenticated
  using (true);

drop policy if exists trucks_office_write on public.trucks;
create policy trucks_office_write on public.trucks
  for all to authenticated
  using (public.is_office())
  with check (public.is_office());

-- rates: справочник курсов, нужен всем — водитель добавляет расход
-- в не-евро валюте и пересчитывает по курсу.
alter table public.rates enable row level security;

drop policy if exists rates_select_authenticated on public.rates;
create policy rates_select_authenticated on public.rates
  for select to authenticated
  using (true);

drop policy if exists rates_office_write on public.rates;
create policy rates_office_write on public.rates
  for all to authenticated
  using (public.is_office())
  with check (public.is_office());

-- reminders: напоминания по водителям — свои + офис.
alter table public.reminders enable row level security;

drop policy if exists reminders_select_own_or_office on public.reminders;
create policy reminders_select_own_or_office on public.reminders
  for select to authenticated
  using (
    public.is_office()
    or (
      entity_type = 'driver'
      and entity_id = public.current_driver_id()
    )
  );

drop policy if exists reminders_office_write on public.reminders;
create policy reminders_office_write on public.reminders
  for all to authenticated
  using (public.is_office())
  with check (public.is_office());

-- ============================================================
-- ROLLBACK
-- ============================================================
-- alter table public.drivers disable row level security;
-- alter table public.users disable row level security;
-- alter table public.driver_transactions disable row level security;
-- alter table public.trip_cargo disable row level security;
-- alter table public.trip_segment_cargo disable row level security;
-- alter table public.trip_documents disable row level security;
-- alter table public.documents disable row level security;
-- alter table public.trucks disable row level security;
-- alter table public.rates disable row level security;
-- alter table public.reminders disable row level security;
-- drop function if exists public.lookup_login_email(text);
