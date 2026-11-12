-- ============================================================
-- Фаза 39 (продолжение) — учётные данные менеджера.
--
-- Задача: офис должен видеть в карточке менеджера логин и пароль
-- и иметь возможность их задать/сменить — без похода в Supabase.
--
-- Как это устроено:
--
--   1. manager_passwords — пароль, заданный офисом. Хранится
--      открытым текстом: это осознанный компромисс (офис должен
--      видеть пароль, чтобы выдать его менеджеру). Читать таблицу
--      может ТОЛЬКО офис (политика manager_passwords_office_only).
--
--   2. Учётная запись в Supabase Auth создаётся/обновляется через
--      admin API (service_role) в экшене setManagerPassword.
--      Поэтому пароль здесь — не копия, а тот самый пароль, с
--      которым человек реально входит в систему.
--
--   3. Почему отдельная таблица, а не колонка в managers:
--      на managers политика managers_select_own_or_office
--      разрешает менеджеру читать СВОЮ карточку, а колонку RLS
--      скрыть не умеет. Отдельная таблица с политикой «только
--      офис» закрывает пароль от менеджера и от водителя.
--
--   4. managers.password_updated_at — когда офис в последний раз
--      задал или сменил пароль (видно в карточке).
-- ============================================================

begin;

-- 1. Пароли менеджеров: читает и пишет только офис.
create table if not exists public.manager_passwords (
  manager_id uuid primary key references public.managers(id) on delete cascade,
  password text not null,
  updated_at timestamptz not null default now(),
  -- updated_by: id профиля офиса, который задал пароль.
  --
  -- Без ссылки на auth.users(id): в CI-окружении (чистый Postgres со
  -- схемой auth) таблицы auth.users нет, и внешний ключ роняет
  -- применение миграции. Здесь это справочная метка, а не
  -- ссылочная целостность, поэтому ограничение не нужно.
  updated_by uuid
);

comment on table public.manager_passwords is
  'Пароли учётных записей менеджеров. Открытый текст — офис должен '
  'видеть и менять пароль в карточке менеджера. Читать может только '
  'офис (политика manager_passwords_office_only).';

alter table public.manager_passwords enable row level security;

drop policy if exists manager_passwords_office_only on public.manager_passwords;
create policy manager_passwords_office_only on public.manager_passwords
  for all
  using (is_office())
  with check (is_office());

-- 2. Когда офис в последний раз задал/сменил пароль.
alter table public.managers
  add column if not exists password_updated_at timestamptz;

comment on column public.managers.password_updated_at is
  'Когда офис в последний раз задал или сменил пароль менеджера.';

commit;
