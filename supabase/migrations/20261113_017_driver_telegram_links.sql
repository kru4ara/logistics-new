-- ============================================================
-- Фаза 42 — одноразовые ссылки привязки Telegram
-- ============================================================
--
-- ПРОБЛЕМА:
--   Ссылка t.me/<bot>?start=<driver_id> была постоянной, а вебхук
--   перезаписывал drivers.telegram_chat_id любому, кто её открыл.
--   Кто знал UUID водителя, мог перехватить уведомления о его рейсах.
--
-- РЕШЕНИЕ:
--   Ссылка содержит случайный одноразовый токен. В базе хранится
--   только его SHA-256, срок жизни — 24 часа, после использования
--   токен гасится. Доступ к таблице — только service_role (RLS
--   включён, политик нет).
-- ============================================================

begin;

create table if not exists public.driver_telegram_links (
  token_hash text primary key,
  driver_id  uuid not null references public.drivers(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);

comment on table public.driver_telegram_links is
  'Одноразовые токены привязки Telegram к водителю (хранится SHA-256). Доступ только service_role.';

create index if not exists driver_telegram_links_driver_idx
  on public.driver_telegram_links (driver_id);

alter table public.driver_telegram_links enable row level security;

-- Политик нет намеренно: читает и пишет только service_role.
revoke all on public.driver_telegram_links from anon, authenticated;

commit;
