# Релизы и миграции

Как код и миграции попадают на прод. Workflow — `.github/workflows/migrate.yml`.

```
PR ──► CI (tsc, lint, тесты, RLS на чистой базе) ──► staging-база (если есть)
merge в master ──► Vercel деплоит код ──► GitHub ждёт деплой ──► план ──► ✅ подтверждение ──► миграции на прод
```

## Настройка (один раз, ~10 минут)

Все строки подключения вводятся **только в GitHub**, не в чат и не в код.

### 1. Окружение `migrations`

GitHub → репозиторий → **Settings → Environments → New environment** → `migrations`. (Окружения `Production` и `Preview` создал Vercel для своих деплоев — их не трогать.)

- **Required reviewers** — отметить себя. Без вашего нажатия «Approve» миграция не пойдёт.
- **Deployment branches** → *Selected branches* → `master`.
- **Environment secrets → Add secret**:
  - `PROD_DATABASE_URL` — Supabase → **Connect → Session pooler** (строка `postgresql://postgres.<ref>:<пароль>@aws-…pooler.supabase.com:5432/postgres`).
  - *(когда клиентов несколько)* вместо него `TENANTS_JSON` — `[{"name":"raibuilding","url":"postgresql://…"},{"name":"…","url":"…"}]`. Тогда миграция идёт на все базы по очереди.

### 2. Проверка

**Actions → Migrations → Run workflow**, галочка «Только показать план» включена → Approve.
Ожидаемо: `база: актуальна (N миграций)`. Если пишет «к применению …» то, что уже применено руками, — журнал `schema_migrations` неполный; напишите, разберём (`--adopt-through`).

### 3. Staging (по желанию, рекомендуется)

Отдельная база, куда миграции попадают ещё на PR — ошибка видна до прода.

1. Supabase → **New project** `logistics-staging` (Free, регион eu-west-1).
2. GitHub → Environments → `staging` (без reviewers) → secret `STAGING_DATABASE_URL` (Session pooler нового проекта).
3. Первый прогон на пустую базу: workflow сам применит baseline и все миграции.
4. Vercel → Settings → Environment Variables → для **Preview** указать URL и ключи staging-проекта (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Тогда превью-деплои PR работают на staging, а не на живых данных.

## Что делать, если миграция упала

- Прод не тронут частично: каждая миграция выполняется целиком, журнал пишется после успеха.
- Код уже задеплоен, но он совместим со старой схемой (правило в `AGENTS.md` → «Миграции»), поэтому приложение работает.
- Исправление — новый PR с исправленной миграцией (тот же файл, если он ещё нигде не применён).
