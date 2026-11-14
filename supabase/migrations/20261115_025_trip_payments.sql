-- 025: счёт и оплата заказа — для контроля дебиторки (/receivables).
--
-- trips.invoice_number / invoiced_at / payment_due / paid_at — номер и дата счёта,
-- срок оплаты, дата фактической оплаты. clients.payment_days — срок оплаты клиента
-- в днях (пусто = 30).
--
-- Триггер ставит даты сам при смене статуса — откуда бы статус ни менялся
-- (карточка, массовые действия, кнопки статуса): правило живёт в базе, а не
-- в каждом месте кода. Вручную заданные даты не перезаписываются.
--
-- Идемпотентна (CI применяет миграции дважды).

alter table public.trips
  add column if not exists invoice_number text,
  add column if not exists invoiced_at date,
  add column if not exists payment_due date,
  add column if not exists paid_at date;

alter table public.clients
  add column if not exists payment_days integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_payment_days_range') then
    alter table public.clients
      add constraint clients_payment_days_range check (payment_days is null or payment_days between 0 and 365);
  end if;
end $$;

-- security definer: водитель меняет статус своего рейса, но читать clients по RLS
-- не может — срок оплаты клиента нужен триггеру всё равно. Функцию-триггер
-- нельзя вызвать напрямую, только как триггер.
create or replace function public.trips_payment_dates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  days integer;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status in ('invoiced', 'paid') then
    if new.invoiced_at is null then
      new.invoiced_at := current_date;
    end if;
    if new.payment_due is null then
      select c.payment_days into days from public.clients c where c.id = new.client_id;
      new.payment_due := new.invoiced_at + coalesce(days, 30);
    end if;
  end if;

  if new.status = 'paid' and new.paid_at is null then
    new.paid_at := current_date;
  end if;

  -- оплату отменили (статус вернули назад) — дата оплаты больше не верна
  if old.status = 'paid' and new.status <> 'paid' then
    new.paid_at := null;
  end if;

  return new;
end;
$$;

revoke all on function public.trips_payment_dates() from public, anon, authenticated;

drop trigger if exists trips_payment_dates on public.trips;
create trigger trips_payment_dates
  before update of status on public.trips
  for each row execute function public.trips_payment_dates();

create index if not exists trips_status_payment_due_idx on public.trips (status, payment_due);
