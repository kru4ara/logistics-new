-- ============================================================
-- 020: закрыть выполнение произвольного SQL и публичный доступ к файлам
-- ============================================================
--
-- Найдено 14.11.2026 при выгрузке схемы прода. Применено на проде вручную
-- в тот же день; миграция фиксирует это в git и для баз новых клиентов.
--
-- 1. exec_sql(text) / exec_sql_json(text) — SECURITY DEFINER, выполняют
--    ЛЮБОЙ переданный SQL с правами владельца базы (в обход RLS), и EXECUTE
--    был у anon и authenticated. С публичным anon-ключом через
--    /rest/v1/rpc/exec_sql можно было прочитать или удалить всю базу.
--    Код приложения их не вызывает; оставляем только service_role.
--
-- 2. merge_contractors — SECURITY DEFINER (удаляет подрядчика), EXECUTE у всех.
--    merge_clients — то же право. Приложение зовёт обе через admin-клиент.
--
-- 3. Политики storage.objects для бакета documents разрешали роли public
--    (в т.ч. anon) просматривать список, загружать, перезаписывать и удалять
--    файлы — включая сканы паспортов. Приложение работает с файлами только
--    через admin-клиент (service_role обходит RLS хранилища), поэтому
--    политики не нужны. Чтение по прямой ссылке /object/public/ работает
--    без политик, пока бакет публичный (перевод в закрытый — отдельно).
--
-- Порядок: в любой момент — приложение эти права не использует.
-- ============================================================

begin;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.exec_sql(text)',
    'public.exec_sql_json(text)',
    'public.merge_contractors(uuid, uuid)',
    'public.merge_clients(uuid, uuid)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', f);
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end;
$$;

do $$
declare
  p text;
begin
  if to_regclass('storage.objects') is null then
    return;  -- CI: схемы storage нет
  end if;
  foreach p in array array[
    'Allow delete documents',
    'Allow public delete access to documents',
    'Allow public insert access to documents',
    'Allow public update access to documents',
    'Allow public read access to documents',
    'Allow read documents'
  ] loop
    execute format('drop policy if exists %I on storage.objects', p);
  end loop;
end;
$$;

commit;
