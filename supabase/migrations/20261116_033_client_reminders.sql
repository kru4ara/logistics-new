-- 033: напоминания клиентам о просроченных счетах (email).
--
-- clients.mail_locale — язык писем клиенту (pl | en | ru | uk), пусто — польский.
-- client_reminders — журнал отправленных напоминаний: когда, кому, по каким заказам.
-- Доступ — только сервер (RLS без политик).

begin;

alter table public.clients add column if not exists mail_locale text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_mail_locale_check') then
    alter table public.clients
      add constraint clients_mail_locale_check check (mail_locale is null or mail_locale in ('pl', 'en', 'ru', 'uk'));
  end if;
end $$;

create table if not exists public.client_reminders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  sent_at timestamptz not null default now(),
  sent_by text,
  to_email text not null,
  locale text,
  trip_ids uuid[] not null default '{}',
  total_eur numeric(12, 2),
  attachments int not null default 0
);

create index if not exists client_reminders_client on public.client_reminders (client_id, sent_at desc);

alter table public.client_reminders enable row level security;

commit;
