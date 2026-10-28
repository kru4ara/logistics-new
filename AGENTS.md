<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## Клиенты Supabase

Три клиента, роли строго разные. Не смешивать.

| Файл | Ключ | Права | RLS | Где применять |
|---|---|---|---|---|
| `lib/supabase/admin.ts` | `service_role` | полные, обходит RLS | ❌ обходит | server components, route handlers, server actions — только когда нужны права админа |
| `lib/supabase/server.ts` | anon + cookies | текущий пользователь | ✅ действует | запросы от имени залогиненного пользователя |
| `lib/supabase/client.ts` | anon | браузер | ✅ действует | client components |

### Правила

1. **По умолчанию — `lib/supabase/server.ts`.** Он работает от имени пользователя и уважает Row Level Security.
2. **`lib/supabase/admin.ts` — только когда действительно нужны права админа** (миграции, фоновые задачи, выборки по чужому `driver_id`). Файл содержит `import 'server-only'` — в клиентский бандл не попадёт.
3. Сейчас RLS в базе **не включён**: почти вся выборка идёт через `admin.ts`, поэтому проверки прав выполняются в коде приложения (`lib/session.ts` → `getSessionContext()`). Это временное состояние, миграция на RLS — в плане работ.
4. Не импортировать `admin.ts` в client components — Next заблокирует сборку, это намеренная защита.
