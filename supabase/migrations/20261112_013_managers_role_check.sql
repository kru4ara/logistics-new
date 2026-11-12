-- ============================================================
-- Фаза 39 (продолжение) — CHECK-ограничение роли профиля.
--
-- Проблема: на profiles стояло ограничение
--
--   CHECK ((role = ANY (ARRAY['admin','driver'])))
--
-- из старой схемы, где ролей было всего две. Роль 'manager' (и 'office')
-- в перечень не входили, поэтому UPDATE profiles SET role = 'manager'
-- отклонялся с 23514, а действие «Привязать» в разделе «Менеджеры»
-- падало с общим экраном ошибки.
--
-- Миграция 012 вводила роль 'manager' в коде (lib/roles.ts) и в БД
-- (is_manager(), current_manager_id()), но CHECK не трогала — при
-- развёртывании на чистой базе ограничение появилось бы снова.
--
-- Что делает миграция:
--
--   1. Пересоздаёт profiles_role_check с полным списком ролей:
--      admin, office, manager, driver.
--
--   2. Переводит профили с role='admin' на role='office' — 'admin'
--      остаётся рабочим синонимом (ROLE_ALIASES в lib/roles.ts),
--      но каноническая роль — 'office'.
--
-- ВАЖНО: всë в одной транзакции — промежуточное состояние без
-- ограничения опасно для прав.
-- ============================================================

begin;

-- 1. Полный перечень ролей.
--
-- 'admin' оставляем: старые профили в БД им помечены, а ROLE_ALIASES
-- отображает его в 'office'. Убирать из CHECK нельзя — тогда UPDATE
-- с role='admin' (например, при назначении менеджера) падал бы.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role is null or role in ('admin', 'office', 'manager', 'driver'));

comment on constraint profiles_role_check on public.profiles is
  'Допустимые роли профиля: admin (синоним office), office, manager, driver.';

-- 2. Каноническая роль для офиса.
update public.profiles
   set role = 'office'
 where lower(btrim(role)) = 'admin';

commit;
