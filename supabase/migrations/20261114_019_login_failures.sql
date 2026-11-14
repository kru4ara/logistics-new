-- 019: журнал неудачных попыток входа — ограничение подбора пароля.
--
-- Код: lib/login-throttle.ts (запись/чтение), lib/login-throttle-rules.ts (правила).
-- 5 неудач на аккаунт или 30 с одного IP за 15 минут — вход закрыт
-- до выхода самой старой из них из окна.
--
-- Логин и IP — только хэши (sha256). Строки старше суток удаляет код.
-- Доступ — только service_role: RLS включён, политик нет.
--
-- Порядок: можно применять до или после деплоя. Без таблицы код
-- пропускает вход (ограничение просто не действует), с таблицей — работает.

create table if not exists public.login_failures (
  id bigint generated always as identity primary key,
  login_hash text not null,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists login_failures_login_idx on public.login_failures (login_hash, created_at desc);
create index if not exists login_failures_ip_idx on public.login_failures (ip_hash, created_at desc);
create index if not exists login_failures_created_idx on public.login_failures (created_at);

alter table public.login_failures enable row level security;

revoke all on table public.login_failures from anon, authenticated;
-- На Supabase service_role получает права на новые таблицы по умолчанию;
-- выдаём явно, чтобы не зависеть от default privileges.
grant select, insert, delete on table public.login_failures to service_role;
