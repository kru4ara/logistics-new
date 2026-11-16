-- 035: роль «бухгалтер» (accountant).
--
-- Права — lib/roles.ts (ACCOUNTANT): деньги и просмотр заказов без логистики.
-- Учётные записи сотрудников офиса заводятся в «Настройки → Сотрудники».
-- Для RLS бухгалтер не офис (is_office() = false): все его страницы и экшены
-- идут через admin-клиент с проверкой прав в коде, как и у офиса.

begin;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role is null or role in ('admin', 'office', 'manager', 'accountant', 'driver'));

comment on constraint profiles_role_check on public.profiles is
  'Допустимые роли профиля: admin (синоним office), office, manager, accountant, driver.';

commit;
