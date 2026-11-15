-- 028: счета подрядчиков (входящие фактуры) из KSeF.
--
-- purchase_invoices — фактуры, где компания — покупатель (Podmiot2), скачанные из KSeF.
--   Хранятся у нас: KSeF просит не запрашивать его повторно для показа (лимиты),
--   а программы фактур удаляют скачанное через год.
--   segment_id — участок рейса подрядчика, к которому относится счёт (авто или вручную).
-- integration_state — служебные отметки интеграций (например, до какого момента
--   KSeF уже просмотрен — High Water Mark).
--
-- Доступ: только сервер (service_role). RLS включён без политик.

begin;

create table if not exists public.purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  ksef_number text not null unique,
  invoice_number text,
  invoice_type text,
  issue_date date,
  seller_nip text,
  seller_name text,
  net_amount numeric(14, 2),
  vat_amount numeric(14, 2),
  gross_amount numeric(14, 2),
  currency text,
  payment_due date,
  bank_account text,
  description text,
  stored_at timestamptz,
  xml text,
  contractor_id uuid references public.contractors (id) on delete set null,
  segment_id uuid references public.trip_segments (id) on delete set null,
  match_status text not null default 'none',
  paid_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_invoices_match_status check (match_status in ('none', 'auto', 'manual', 'ignored'))
);

create index if not exists purchase_invoices_segment_idx on public.purchase_invoices (segment_id);
create index if not exists purchase_invoices_unpaid_idx on public.purchase_invoices (payment_due) where paid_at is null;
create index if not exists purchase_invoices_seller_idx on public.purchase_invoices (seller_nip);

alter table public.purchase_invoices enable row level security;

create table if not exists public.integration_state (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table public.integration_state enable row level security;

commit;
