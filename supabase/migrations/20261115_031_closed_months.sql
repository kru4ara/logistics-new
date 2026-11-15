-- 031: закрытие месяца.
--
-- closed_months — месяцы ('YYYY-MM'), сданные в учёт. Для рейсов закрытого месяца (по дате
-- начала рейса) CRM не меняет стоимость подрядчика автоматически: изменения по счетам ждут
-- подтверждения в отчёте «План → факт». snapshot — итоги месяца на момент закрытия.
-- Доступ — только сервер (RLS без политик).

begin;

create table if not exists public.closed_months (
  month text primary key check (month ~ '^\d{4}-\d{2}$'),
  closed_at timestamptz not null default now(),
  closed_by text,
  snapshot jsonb
);

alter table public.closed_months enable row level security;

commit;
