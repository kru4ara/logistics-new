-- 032: портал клиента — вход по секретной ссылке.
--
-- client_portal_links — ссылки клиентов. Храним только SHA-256 токена (как пароль):
-- саму ссылку видно один раз при создании; потерялась — создать новую (старая гаснет).
-- revoked_at — ссылка отключена. У клиента одна действующая ссылка.
-- Доступ — только сервер (RLS без политик).

begin;

create table if not exists public.client_portal_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  created_by text,
  revoked_at timestamptz,
  last_seen_at timestamptz
);

create unique index if not exists client_portal_links_one_active
  on public.client_portal_links (client_id) where revoked_at is null;

alter table public.client_portal_links enable row level security;

commit;
