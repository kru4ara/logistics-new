-- 030: сумма фактуры клиенту у заказа.
--
-- trips.invoice_amount / invoice_currency — брутто фактуры из сервиса фактур (сверка или
-- выставление из CRM). Дебиторка считает долг по ней, а не по фрахту заказа: в фактуру
-- бывает добавлена доплата или фрахт в заказе не обновлён (рейс 30Е: 4 100 € против 3 900 €).
--
-- Порядок: ДО деплоя кода или сразу после — без колонок дебиторка не открывается.

begin;

alter table public.trips
  add column if not exists invoice_amount numeric(12, 2),
  add column if not exists invoice_currency text;

commit;
