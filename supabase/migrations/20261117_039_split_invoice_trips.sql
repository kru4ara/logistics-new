-- 039: один счёт подрядчика на несколько рейсов (месячные счета агентств: Polbalt, IMEX).
--
-- Было: одна строка trip_expenses на счёт (уникальность по purchase_invoice_id).
-- Стало: одна строка на пару «счёт + рейс» — доля счёта в каждом рейсе.
-- contract: снимаем уникальность по одному purchase_invoice_id. Безопасно для кода
-- до PR «разделение счёта»: он писал по одной строке на счёт, это остаётся допустимым;
-- код с разделением уже читает список строк, а не одну.

begin;

create unique index if not exists trip_expenses_purchase_invoice_trip_key
  on public.trip_expenses (purchase_invoice_id, trip_id)
  where purchase_invoice_id is not null;

drop index if exists public.trip_expenses_purchase_invoice_key;

commit;
