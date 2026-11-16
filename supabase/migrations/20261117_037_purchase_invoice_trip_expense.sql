-- 037: счёт подрядчика как расход рейса (не участка перевозчика).
--
-- Перегруз, EX-1, EPI, склад: счёт относится к рейсу целиком. purchase_invoices.trip_id —
-- к какому рейсу; trip_expenses.purchase_invoice_id — строка расхода, созданная из счёта
-- (одна на счёт), чтобы маржа рейса и отчёты видели расход как обычный.
-- Только добавление колонок и индексов: старый код их не читает.

begin;

alter table public.purchase_invoices
  add column if not exists trip_id uuid references public.trips (id) on delete set null;

create index if not exists purchase_invoices_trip_idx on public.purchase_invoices (trip_id);

alter table public.trip_expenses
  add column if not exists purchase_invoice_id uuid references public.purchase_invoices (id) on delete cascade;

create unique index if not exists trip_expenses_purchase_invoice_key
  on public.trip_expenses (purchase_invoice_id)
  where purchase_invoice_id is not null;

commit;
