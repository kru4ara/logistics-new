-- ============================================================
-- Фаза 42 — lookup_login_email только для сервера
-- ============================================================
--
-- ПРОБЛЕМА:
--   Функция отдавала e-mail по фамилии водителя / имени менеджера и
--   была доступна роли anon. Anon-ключ публичный, поэтому любой человек
--   мог вызвать /rest/v1/rpc/lookup_login_email и перебором фамилий
--   собрать e-mail сотрудников.
--
-- РЕШЕНИЕ:
--   Вызов только от service_role. Приложение (app/login/actions.ts)
--   зовёт функцию через admin-клиент на сервере.
--
-- ПОРЯДОК РАСКАТКИ:
--   1. Сначала деплой кода (вход через admin-клиент).
--   2. Затем эта миграция. Наоборот нельзя: до деплоя вход по логину
--      сломается.
-- ============================================================

begin;

revoke all on function public.lookup_login_email(text) from public, anon, authenticated;

-- В CI (чистый Postgres) роли service_role может не быть.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.lookup_login_email(text) to service_role;
  end if;
end $$;

commit;
