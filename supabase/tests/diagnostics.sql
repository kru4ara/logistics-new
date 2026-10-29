-- ============================================================
-- Диагностика окружения RLS
-- ============================================================
-- Выполняется в CI ПЕРЕД тестами поведения. Ничего не проверяет и
-- ничего не меняет (только SELECT и NOTICE) — задача другая: показать
-- истинные значения, когда тест падает. Без этого приходилось
-- угадывать по одной строке "ожидалось 2, получено 0".
--
-- Читать лог: ищи секцию "=== RLS DIAGNOSTICS ===".

\echo ''
\echo '=== RLS DIAGNOSTICS ==='

\echo '--- версии ---'
select version();

\echo '--- роли ---'
select rolname, rolsuper, rolbypassrls from pg_roles
 where rolname in ('anon','authenticated','service_role','postgres') order by rolname;

\echo '--- RLS включён? ---'
select c.relname, c.relrowsecurity, c.relforcerowsecurity
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r'
 order by c.relname;

\echo '--- политики на public ---'
select tablename, policyname, cmd, roles::text
  from pg_policies where schemaname='public' order by tablename, policyname;

\echo '--- auth.uid() / is_office() / current_driver_id() под authenticated ---'
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select
  current_setting('request.jwt.claim.sub', true) as claim_sub,
  auth.uid() as uid,
  public.is_office() as is_office,
  public.current_driver_id() as current_driver_id;

\echo '--- профили, которые видит authenticated ---'
select id, role, driver_id from public.profiles;

\echo '--- владелец и RLS-обход функций-владельцев ---'
select p.proname, pg_get_userbyid(p.proponowner) as owner,
       p.prosecdef as security_definer,
       p.proconfig::text as config
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public'
   and p.proname in ('is_office','current_driver_id','driver_owns_trip',
                     'driver_owns_segment','driver_owns_segment_cargo',
                     'driver_has_client','driver_uses_contractor')
 order by p.proname;

\echo '--- grant execute на функции-владельцы ---'
select p.proname,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_can_execute
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public'
   and p.proname in ('is_office','current_driver_id','driver_owns_trip',
                     'driver_owns_segment','driver_owns_segment_cargo',
                     'driver_has_client','driver_uses_contractor')
 order by p.proname;

\echo '--- владелец таблиц ---'
select c.relname, pg_get_userbyid(c.relowner) as table_owner
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and c.relname in ('trips','profiles','clients')
 order by c.relname;

\echo '--- чтение trips под authenticated (RLS) ---'
select count(*) as trips_via_rls from public.trips;

\echo '--- чтение trips под service_role (обход RLS) ---'
reset role;
set role service_role;
select count(*) as trips_via_service_role from public.trips;

\echo '=== END RLS DIAGNOSTICS ==='
\echo ''

reset role;
