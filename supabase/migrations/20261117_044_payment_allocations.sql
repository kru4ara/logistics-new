-- 044: распределение приходов от клиентов по заказам.
--
-- Один приход может закрыть несколько счетов, счёт может быть оплачен частями, а
-- аванс приходит до счёта. payment_allocations — сколько из какой операции выписки
-- легло на какой заказ (в валюте операции). Заказ «оплачен», когда распределено не
-- меньше суммы счёта; остаток прихода без распределения — аванс клиента.
-- Только добавление.

begin;

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  bank_transaction_id uuid not null references public.bank_transactions (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  amount numeric(14, 2) not null,
  currency text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint payment_allocations_amount check (amount > 0)
);

create unique index if not exists payment_allocations_tx_trip_key
  on public.payment_allocations (bank_transaction_id, trip_id);
create index if not exists payment_allocations_trip_idx on public.payment_allocations (trip_id);

alter table public.payment_allocations enable row level security;
-- Как выписки: только офис и бухгалтер через service_role.
revoke all on table public.payment_allocations from anon, authenticated;

commit;
