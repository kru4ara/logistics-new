#!/usr/bin/env python3
# Использование: python3 scripts/build-baseline.py <выгрузка.csv> supabase/migrations/00000000_000_baseline.sql
# CSV — результат scripts/export-schema.sql (Supabase SQL Editor → Export → CSV).
"""Схема прода (CSV из scripts/export-schema.sql) -> идемпотентная базовая миграция."""
import csv, re, sys
csv.field_size_limit(10**9)
src, dst = sys.argv[1], sys.argv[2]
row = next(csv.DictReader(open(src, encoding='utf-8')))
stmts = [s.strip() for s in row['schema_sql'].split('\n\n') if s.strip()]
# склеиваем функции: тело функции может содержать пустые строки
merged, buf = [], None
for s in stmts:
    if buf is not None:
        buf += '\n\n' + s
        if re.search(r'\$function\$\s*;\s*$', buf): merged.append(buf); buf = None
        continue
    if s.startswith('CREATE OR REPLACE FUNCTION') and not re.search(r'\$function\$\s*;\s*$', s):
        buf = s; continue
    merged.append(s)
assert buf is None
out = []
SUPABASE_MANAGED_EXT = {'pg_stat_statements', 'supabase_vault'}
SECURITY_LOCK = {  # функции, закрытые 14.11.2026 (миграция 020): только service_role
    'exec_sql(query text)', 'exec_sql_json(query text)',
    'merge_contractors(source_id uuid, target_id uuid)', 'merge_clients(source_id uuid, target_id uuid)'}
for s in merged:
    m = re.match(r'create extension if not exists ("?[\w-]+"?) with schema (\w+);', s)
    if m:
        name = m.group(1).strip('"')
        if name in SUPABASE_MANAGED_EXT: continue
        out.append(f'create schema if not exists {m.group(2)};\n' + s); continue
    m = re.match(r'alter table (public\.\w+) add constraint (\w+) (.*);$', s, re.S)
    if m:
        tbl, con, body = m.groups()
        out.append(f"do $$ begin\n  if not exists (select 1 from pg_constraint where conname = '{con}' and conrelid = '{tbl}'::regclass) then\n    alter table {tbl} add constraint {con} {body};\n  end if;\nend $$;")
        continue
    if s.startswith('CREATE INDEX ') or s.startswith('CREATE UNIQUE INDEX '):
        out.append(s.replace('CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS ', 1).replace('CREATE UNIQUE INDEX ', 'CREATE UNIQUE INDEX IF NOT EXISTS ', 1)); continue
    m = re.match(r'CREATE TRIGGER (\w+) .*? ON (public\.\w+) ', s, re.S)
    if m:
        out.append(f'drop trigger if exists {m.group(1)} on {m.group(2)};\n' + s); continue
    m = re.match(r'create policy ("[^"]+"|\w+) on (\w+)\.(\w+) ', s)
    if m:
        pol, sch, tb = m.groups()
        if sch == 'storage':  # публичные политики хранилища удалены 14.11.2026 (миграция 020)
            continue
        out.append(f'drop policy if exists {pol} on {sch}.{tb};\n' + s); continue
    m = re.match(r'grant execute on function public\.(.+?) to (\w+);$', s)
    if m and m.group(1) in SECURITY_LOCK and m.group(2) != 'service_role':
        continue
    if s.startswith('insert into storage.buckets'):
        out.append("do $$ begin\n  if to_regclass('storage.buckets') is not null then\n    " + s + "\n  end if;\nend $$;"); continue
    out.append(s)
out.append("""-- Профиль при регистрации пользователя (триггер на auth.users, схема auth
-- в выгрузку не входит — определение снято с прода 14.11.2026).
do $$ begin
  if to_regclass('auth.users') is not null then
    drop trigger if exists on_auth_user_created on auth.users;
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;""")
header = """-- ============================================================
-- 000: БАЗОВАЯ СХЕМА — схема public боевой базы на 14.11.2026
-- ============================================================
--
-- Источник: scripts/export-schema.sql на проде (проект smodijsjiwcvsscfgloh),
-- после миграций 001–019. Собрано scripts/build-baseline.py.
--
-- Зачем: ранние таблицы создавались руками в SQL Editor, и из миграций
-- 001–019 новую базу не собрать. Эта миграция создаёт всё с нуля —
-- для базы нового клиента и для CI (вместо заглушки supabase/stubs/schema.sql).
--
-- Идемпотентна: на существующей базе ничего не меняет (if not exists,
-- drop/create для политик и триггеров с теми же определениями).
--
-- Отличия от прода на момент выгрузки (исправлены миграцией 020):
--   * exec_sql / exec_sql_json / merge_* — EXECUTE только service_role;
--   * публичные политики storage.objects для бакета documents не создаются.
-- Таблицы bak_* (ручные бэкапы прода) сюда не входят.
--
-- Расширения pg_stat_statements и supabase_vault Supabase ставит сам.
-- ============================================================

begin;
"""
open(dst, 'w', encoding='utf-8').write(header + '\n' + '\n\n'.join(out) + '\n\ncommit;\n')
print('statements in:', len(merged), 'out:', len(out))
