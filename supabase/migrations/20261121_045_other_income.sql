-- 045: прочие доходы — деньги, пришедшие не оплатой счёта клиента: компенсации, возвраты
-- от поставщиков, проценты банка, страховые выплаты. Идут в прибыль месяца (P&L),
-- в дебиторку — нет. Строка из выписки связана с операцией (bank_transaction_id) и
-- снимается вместе с её решением в «Банке»; ручную добавляют и удаляют на странице.
-- Только добавление.

begin;

create table if not exists public.other_income (
  id uuid primary key default gen_random_uuid(),
  income_date date not null,
  month_key text not null,
  category text not null,
  description text,
  original_amount numeric(14, 2) not null,
  currency text not null default 'EUR',
  amount_eur numeric(14, 2),
  trip_id uuid references public.trips (id) on delete set null,
  bank_transaction_id uuid references public.bank_transactions (id) on delete cascade,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint other_income_amount check (original_amount > 0)
);

create index if not exists other_income_month_idx on public.other_income (month_key);
create unique index if not exists other_income_tx_key on public.other_income (bank_transaction_id) where bank_transaction_id is not null;

alter table public.other_income enable row level security;
-- Как выписки: только офис и бухгалтер через service_role.
revoke all on table public.other_income from anon, authenticated;

commit;
