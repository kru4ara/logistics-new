-- 040: импорт банковских выписок (PKO BP, PDF).
--
-- bank_statements — загруженная выписка (счёт + период, один раз).
-- bank_transactions — операции выписки и решение по ним: оплата счетов подрядчиков
-- (purchase_invoice_ids), оплата заказов клиентом (trip_ids), общий расход
-- (overhead_category → fixed_costs.bank_transaction_id) или «пропустить».
-- Только добавление: старый код этого не читает.

begin;

create table if not exists public.bank_statements (
  id uuid primary key default gen_random_uuid(),
  bank text not null default 'pko',
  account text not null,
  currency text not null,
  period_from date not null,
  period_to date not null,
  number text,
  opening_balance numeric(14, 2),
  closing_balance numeric(14, 2),
  file_name text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists bank_statements_account_period_key
  on public.bank_statements (account, period_from, period_to);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.bank_statements (id) on delete cascade,
  account text not null,
  currency text not null,
  seq integer not null,
  booking_date date not null,
  value_date date,
  operation_id text,
  op_type text,
  amount numeric(14, 2) not null,
  balance numeric(14, 2),
  description text,
  counterparty text,
  counterparty_account text,
  title text,
  kind text not null,
  status text not null default 'new',
  purchase_invoice_ids uuid[] not null default '{}',
  trip_ids uuid[] not null default '{}',
  overhead_category text,
  suggestion jsonb,
  -- что было до решения (дата оплаты счёта, статус заказа) — для «Отменить»
  undo jsonb,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint bank_transactions_status check (status in ('new', 'matched', 'ignored'))
);

create unique index if not exists bank_transactions_statement_seq_key
  on public.bank_transactions (statement_id, seq);
create index if not exists bank_transactions_status_idx on public.bank_transactions (status, booking_date);

alter table public.bank_statements enable row level security;
alter table public.bank_transactions enable row level security;
-- Как счета подрядчиков: только офис и бухгалтер через service_role; RLS-клиенту — ничего.
revoke all on table public.bank_statements from anon, authenticated;
revoke all on table public.bank_transactions from anon, authenticated;

alter table public.fixed_costs
  add column if not exists bank_transaction_id uuid references public.bank_transactions (id) on delete cascade;

create unique index if not exists fixed_costs_bank_transaction_key
  on public.fixed_costs (bank_transaction_id)
  where bank_transaction_id is not null;

alter table public.purchase_invoices
  add column if not exists bank_transaction_id uuid references public.bank_transactions (id) on delete set null;

commit;
