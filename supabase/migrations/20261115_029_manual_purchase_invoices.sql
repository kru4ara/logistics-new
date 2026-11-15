-- 029: счета подрядчиков без KSeF (иностранные перевозчики — PDF по email).
--
-- purchase_invoices.source    — 'ksef' (скачан из KSeF) | 'manual' (внесён в офисе)
-- purchase_invoices.file_path — PDF/скан в бакете documents (у ручных)
-- ksef_number у ручных пустой; у скачанных из KSeF по-прежнему уникален.
-- Один участок может иметь несколько счетов (основной, доплата, korekta).

begin;

alter table public.purchase_invoices alter column ksef_number drop not null;

alter table public.purchase_invoices
  add column if not exists source text not null default 'ksef',
  add column if not exists file_path text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'purchase_invoices_source_check') then
    alter table public.purchase_invoices add constraint purchase_invoices_source_check
      check (source in ('ksef', 'manual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'purchase_invoices_ksef_needs_number') then
    alter table public.purchase_invoices add constraint purchase_invoices_ksef_needs_number
      check (source <> 'ksef' or ksef_number is not null);
  end if;
end $$;

-- Ручной счёт одного подрядчика с тем же номером — дубль.
create unique index if not exists purchase_invoices_manual_number_key
  on public.purchase_invoices (contractor_id, lower(invoice_number))
  where source = 'manual' and contractor_id is not null and invoice_number is not null;

commit;
