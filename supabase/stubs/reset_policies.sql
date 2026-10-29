-- ============================================================
-- Снять все политики RLS со всех таблиц public
-- ============================================================
-- Выполняется ДО применения миграций: проверка должна идти по
-- политикам из git, а не по тем, что случайно остались в базе.
-- В чистой базе это no-op, но защищает от «грязного» окружения
-- при локальном прогоне.

do $$
declare
  r record;
  p record;
begin
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    for p in select policyname from pg_policies
             where schemaname = 'public' and tablename = r.tablename
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, r.tablename);
    end loop;
  end loop;
end;
$$;
