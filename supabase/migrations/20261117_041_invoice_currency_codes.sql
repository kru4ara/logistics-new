-- 041: валюта счёта клиенту кодом Fakturowo («1» — EUR, «0» — PLN) → ISO-код.
--
-- Синхронизация с Fakturowo сохраняла код как есть: дебиторка и «План → факт» считали
-- такие счета «не в евро», банк не сверял суммы. Код исправлен; здесь — уже сохранённое.
-- Только правка данных, идемпотентно.

update public.trips set invoice_currency = 'EUR' where invoice_currency = '1';
update public.trips set invoice_currency = 'PLN' where invoice_currency = '0';
