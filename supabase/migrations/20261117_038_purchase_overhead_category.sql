-- 038: разбор счетов «не относится к рейсам» — категория накладных и правило по продавцу.
--
-- purchase_invoices.overhead_category — за что счёт, если он не к рейсу (бухгалтерия,
-- сервис машин, инвестиция…). purchase_seller_rules — что делать с новыми счетами этого
-- продавца (NIP без префикса): 'trip' — привязывать к рейсам, 'overhead' — сразу в
-- накладные с категорией. fixed_costs.purchase_invoice_id — строка общих расходов,
-- созданная из такого счёта (одна на счёт): дашборд, статистика и fixed_costs_by_month
-- видят её как обычный общий расход. Только добавление: старый код этого не читает.

begin;

alter table public.purchase_invoices
  add column if not exists overhead_category text;

create table if not exists public.purchase_seller_rules (
  seller_nip text primary key,
  assignment text not null,
  category text,
  updated_at timestamptz not null default now(),
  constraint purchase_seller_rules_assignment check (assignment in ('trip', 'overhead'))
);

alter table public.purchase_seller_rules enable row level security;

alter table public.fixed_costs
  add column if not exists purchase_invoice_id uuid references public.purchase_invoices (id) on delete cascade;

create unique index if not exists fixed_costs_purchase_invoice_key
  on public.fixed_costs (purchase_invoice_id)
  where purchase_invoice_id is not null;

-- Как purchase_invoices: читает и пишет только офис (через service_role); RLS-клиенту — ничего.
revoke all on table public.purchase_seller_rules from anon, authenticated;

commit;
