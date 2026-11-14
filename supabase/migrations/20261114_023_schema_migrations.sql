-- ============================================================
-- 023: журнал применённых миграций
-- ============================================================
--
-- Какая миграция когда применена к этой базе. Ведёт scripts/migrate.mjs
-- (он же создаёт таблицу, если её нет). Нужен, когда баз много — у каждого
-- клиента своя (docs/MULTITENANCY_PLAN.md): без журнала не узнать, какая
-- база на какой версии.
--
-- Прод (миграции применялись вручную) — один раз отметить применённые:
--   DATABASE_URL='…' node scripts/migrate.mjs --adopt-through 20261114_022_company_settings
-- и затем обычным запуском применить 023 и всё новое.
--
-- Доступ — только service_role / владелец базы.
-- ============================================================

begin;

create table if not exists public.schema_migrations (
  version text primary key,
  checksum text not null,
  applied_at timestamptz not null default now(),
  adopted boolean not null default false
);

comment on table public.schema_migrations is
  'Журнал миграций (scripts/migrate.mjs). adopted = отмечена как применённая без выполнения (применялась вручную до появления журнала).';

alter table public.schema_migrations enable row level security;
revoke all on table public.schema_migrations from public, anon, authenticated;

commit;
