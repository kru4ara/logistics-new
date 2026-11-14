-- ============================================================
-- 024: язык интерфейса пользователя
-- ============================================================
--
-- profiles.locale — ru | pl | en | uk (lib/i18n/config.ts). NULL — язык
-- браузера, иначе русский. Ставит сам пользователь переключателем
-- (app/locale-actions.ts); при входе копируется в cookie `locale`,
-- чтобы язык следовал за ним на любое устройство.
--
-- Порядок: в любой момент. Без колонки язык хранится только в cookie.
-- ============================================================

begin;

alter table public.profiles add column if not exists locale text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_locale_check'
                 and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles
      add constraint profiles_locale_check check (locale is null or locale in ('ru', 'pl', 'en', 'uk'));
  end if;
end;
$$;

comment on column public.profiles.locale is
  'Язык интерфейса: ru | pl | en | uk. NULL — язык браузера, иначе русский.';

commit;
