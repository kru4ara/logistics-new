-- 036: требовать двухфакторный вход от сотрудников офиса.
--
-- company_settings.require_staff_2fa — включает офис в «Настройки → Сотрудники».
-- Пока выключено, 2FA подключает каждый сам (Безопасность входа). Включено —
-- сотрудник офиса, бухгалтер и менеджер без 2FA сразу попадают на её подключение.

begin;

alter table public.company_settings
  add column if not exists require_staff_2fa boolean not null default false;

-- Флаг нужен proxy.ts для любого сотрудника, а company_settings читает только
-- офис (реквизиты, счета). Отдаём один флаг, без остальных колонок.
create or replace function public.staff_2fa_required()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select require_staff_2fa from public.company_settings where id = 1), false);
$$;

revoke all on function public.staff_2fa_required() from public;
grant execute on function public.staff_2fa_required() to authenticated, service_role;

commit;
