# HANDOVER — Logistics CRM

**Обновлено: 13.11.2026.** Файл — рабочая справка, не летопись. История фаз вынесена
в [HANDOVER_PHASES.md](HANDOVER_PHASES.md).

**Прод:** https://logistics-new-ebon.vercel.app (канонический домен; в API деплоя Vercel отдаёт
алиас последнего билда, например `https://logistics-bvd09gp7p-kru4aras-projects.vercel.app`)
**Репозиторий:** `kru4ara/logistics-new`, ветка `master`
**Supabase:** проект `logistics-core` (org Raibuilding), ref `smodijsj`**`i`**`wcvsscfgloh` (с буквой `i`!)
**Vercel:** `kru4aras-projects/logistics-new`

---

## 1. Стек

- **Next.js 16.4.3** (App Router, Turbopack) + React 19.3.1 + Supabase + Vercel
- **Tailwind CSS 4.3.3** — конфиг через `@theme` в `app/globals.css`, файла `tailwind.config.js` нет
- **Vitest 5** — **185 тестов в 17 файлах** `lib/__tests__/`, **eslint-config-next 16.4.3**, **exceljs 4.4**

### ENV (Vercel → Settings → Environment Variables)
`NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` (клиент, RLS действует) ·
`SUPABASE_SERVICE_ROLE_KEY` (server, обходит RLS) · `LOGISAT_SERVER` / `LOGISAT_USERNAME` /
`LOGISAT_PASSWORD` · `TELEGRAM_BOT_TOKEN` (@raibuilding_bot) · `TELEGRAM_CHAT_ID` (`921520481`) ·
`TELEGRAM_WEBHOOK_SECRET` ✅ · `CRON_SECRET` ✅ ·
`BACKUP_ENCRYPTION_KEY` (32 байта base64, `openssl rand -base64 32`; **копия — в менеджере паролей**, без неё бэкап не расшифровать)

---

## 2. Правила работы

### ⚠️ Правки кода — только через GitHub API
- Файлы правим **прямым редактированием целиком**: пишем финальный файл и коммитим.
  **Нельзя** вырезать JSX-блоки из исходников парсерами (сканеры тегов, матчеры скобок) —
  это уже трижды теряло результат.
- Коммиты — **от имени Anatoli** (`78858463+kru4ara@users.noreply.github.com`, аккаунт `kru4ara`).
  При авторстве `mira@users.noreply.github.com` GitHub привязывает коммит к пользователю
  «mira», которого нет в Vercel → деплой уходит только в Preview и **в Production не попадает**.
- **Один коммит = связанные файлы.** `import` — в начале файла.
- `master` **не защищён** (осознанно). Ветка + PR с CI → **мержит владелец**.
- Локально: `git pull --no-edit` перед проверками. Конфликт в `package.json` — наша версия.
  `sed` по JSX — запрещён.

### Рабочий процесс AI
- Пользователь сам гоняет `tsc` / `lint` / `test` и присылает вывод; AI делает правки,
  коммитит, создаёт ветку и PR **без уточняющих вопросов**.
- Давать **готовый результат**, а не отчёты и промежуточные блоки.

### Не грузить в чат
Бэкапы, старые хендыверы, заменённые файлы, полные логи, огромные JSON, секреты.

---

## 3. Модель данных

```
trips (заказ)  ── trip_segments (участки: исполнитель, машина, водитель, цена)
                ── trip_cargo (груз: фрахт, вес, паллеты, таможня)
                ── trip_expenses (расходы)
                ── trip_documents (документы)
trip_counter (нумерация) · profiles (роль, driver_id, manager_id)
managers (карточки менеджеров) · driver_telegram_links (одноразовые токены привязки Telegram)
```

### Режим расчёта — не выбирается
`deriveProfitMode()` в `lib/orders-core.ts` и `public.derive_profit_mode(uuid)` в БД:
наш транспорт (машина + водитель) → **рейс**; только подрядчик → **экспедирование**;
смешанный → **рейс**; нет сегментов → **без номера**.

### Даты заказа (принято 07.11.2026, PR #53)
- `trips.start_date` / `end_date` — **фактические** даты (рейс: старт/финиш машины;
  экспедиция: факт. погрузка/разгрузка).
- `trips.load_date` / `unload_date` — **плановые**, в расчётах/статистике/нумерации не участвуют.
- `trip_segments.date_from` / `date_to` — план по участку.
- Месяц заказа, «дата выгрузки», сортировка и нумерация считаются по `end_date` для обоих режимов.
- Триггер `sync_trip_from_segment` больше не затирает факт планом.

---

## 4. Права доступа

- **30 capability**, `lib/roles.ts`. Проверка — только `can(role, 'cap.capability')`.
  Путь → право: `capabilityForRequest(pathname, method)` (24 правила, отдельно на чтение и запись).
- Роли: `office` — все 30 · `manager` — 26 (офис минус `audit.view`, `export.view`,
  `managers.view`, `managers.edit`) · `driver` — 5 (`trips.view`, `expenses.view`,
  `expenses.edit`, `logisat.view`, `reminders.view`).
- `ROLE_ALIASES`: **только** `admin → office`. `manager` — **отдельная роль**, не синоним офиса.
- Роли `logistics`, `accountant`, `client` заведены в коде, но никому не выдаются.

### Периметр менеджера — это скоуп данных, а не capability
`lib/scope-rules.ts`: `managerTripFilter()` → «без менеджера **ИЛИ** мой»;
`tripVisibleToScope()` для заказа по id; `filterTripsByScope()` для списков в памяти.

### Клиенты Supabase
| Файл | Роль | RLS |
|---|---|---|
| `lib/supabase/admin.ts` | `service_role`, `server-only` | обходит |
| `lib/supabase/server.ts` | anon + куки, `server-only` | действует |
| `lib/supabase/client.ts` | — удалён, браузерных запросов нет | — |
| `proxy.ts` | свой `createServerClient` | — |

`proxy.ts` **не дубль**: нужен `request.cookies`, в server-клиенте — `cookies()` из `next/headers`.

### Владение данными — решает БД
`requireTripAccess` / `requireExpenseAccess` из `lib/driver-access.ts`;
политика `driver_owns_trip` — не дублировать её в коде.

---

## 5. Менеджеры по логистике (Фаза 40 — **выкачена на прод**)

- Таблица `managers`, колонки `profiles.manager_id` и `trips.manager_id` — **в проде есть**.
- Раздел `/managers` (список, создание, карточка) — только для офиса.
- **Пароль менеджера нигде не хранится и не показывается** (Фаза 42): только хэш в `auth.users`.
  Офис задаёт новый пароль в карточке — старый посмотреть нельзя. Таблица `manager_passwords`
  удалена миграцией `018`.
- `setManagerPassword` (`app/managers/actions.ts`) синхронизирует: `auth.users` (пароль через admin API,
  поиск по e-mail обходит все страницы `listUsers`), карточку `managers`, `profiles`
  (`role='manager'`, `manager_id`).

---

## 6. Вход по логину (Фаза 41 — работает)

`public.lookup_login_email(text)` — `SECURITY DEFINER`, ищет e-mail **до** авторизации.
Порядок источников: `auth.users` (прямой e-mail) → `managers.full_name` → `managers.email` →
`drivers.last_name` → `drivers.email` → `public.users.login` (легаси) → `auth.users` по локальной части e-mail.

Вызывается из `app/login/actions.ts` **через admin-клиент**; если вход содержит `@` — функция не вызывается,
e-mail идёт напрямую. С миграции `016` вызывать её может **только `service_role`**: под `anon` любой мог
перебором фамилий собрать e-mail сотрудников.

**Проверено вживую на проде 12.11.2026:**
`office` → `office@raibuilding.pl` · `ANATOLI KURLIUK` → `kru4ara@gmail.com` ·
`KAVALIOU` → `kavaliou@raibuilding.pl` · вход по e-mail → `kru4ara@gmail.com` ·
неизвестный логин → `null`.

---

## 7. Миграции

- Папка `supabase/migrations/`, применяются **вручную** в Supabase SQL Editor.
- Последняя — `20261113_018_drop_manager_passwords.sql` (**применена на проде 13.11.2026**,
  вместе с `016_lookup_login_email_server_only` и `017_driver_telegram_links`, после деплоя PR #63).
  Перед ними: `015_fix_lookup_login_email`, `014_manager_passwords`, `013_manager_role_check`,
  `012_managers`, `011_lock_backup_tables`.
- **Миграция, которая меняет права или удаляет то, чем пользуется код, — строго после деплоя кода.**
- **Ждёт применения:** `20261114_019_login_failures.sql` (ограничение попыток входа). Порядок не важен:
  без таблицы код пропускает вход, ограничение просто не действует.
- **Каждая миграция обязана быть в транзакции** (`BEGIN`/`COMMIT`) — иначе `psql -f` при ошибке
  оставит базу в полуприменённом состоянии.
- **DDL из приложения недоступен:** RPC `exec_sql_json` даёт `select`, но не `create/alter`.

---

## 8. CI и тесты

- **Воркфлоу `CI`** — lint → `tsc --noEmit` → test → build.
- **Воркфлоу `RLS`** — миграции на чистом Postgres + проверка **поведения** политик.
  Миграции применяются **дважды** — намеренная проверка идемпотентности.

### ⚠️ Грабли RLS-теста
1. **Стабы обязаны повторять реальную схему.** Расхождение (`public.users.email`) дважды давало
   зелёный CI при сломанном проде. При добавлении таблицы/колонки в `auth` или `public`
   править `supabase/stubs/schema.sql` в том же PR.
2. **Фикстуры вставлять под `reset role`** (владелец базы), потом возвращать `set role authenticated`.
   У роли `authenticated` только чтение → прямая вставка даёт `permission denied for table users`
   и роняет джобу.
3. **Локальный прогон** (Postgres 17 в песочнице): `initdb` в `/tmp/pgdata`, `pg_ctl` на порту 5433,
   база `rls_test`. Порядок как в `.github/workflows/rls.yml`: `prepare.sql` → `schema.sql` →
   `reset_policies.sql` → миграции → миграции повторно → `diagnostics.sql` → `rls_policies.test.sql`.
   Кластер пересоздавать **с нуля**: если в базе уже лежат фикстуры теста, миграция
   `20261102_008` падает на `profit_mode not null` (заказ без сегментов).

---

## 9. Состояние данных (проверено на проде 12.11.2026)

- `trips`: **112** (31 — экспедирование, `profit_mode='forwarding'`); без номера — **0**.
- `trip_segments`: 141 · `trip_expenses`: 563 · `profiles`: 4 (из них 1 — `role='manager'`).
- `managers`: 1 (ANATOLI KURLIUK, `kru4ara@gmail.com`, id `b0339d80-4e0d-45bf-896d-3fe6e80e8f3c`).
- `manager_passwords` — удалена (13.11.2026). `public.users` (легаси): 1.
- **Все 112 заказов** закреплены за менеджером; неназначенных — 0. Заказов без `end_date` — 2.
- ⚠️ **`trip_number` нестабилен:** триггер `trg_trip_renumber` обнуляет номер у заказов
  без исполнителя. В разборе данных искать заказы по `id`.

### Аккаунты
- Админ: `raibuilding.pl@gmail.com` (легаси-логин `office` → `office@raibuilding.pl`)
- Менеджер: `kru4ara@gmail.com` (карточка ANATOLI KURLIUK)
- Водители: `vasiliuk@…`, `kavaliou@…`

---

## 10. Очередь задач

1. **Латентный баг миграции `20261102_008`** — на «грязной» базе (заказ без сегментов)
   падает `profit_mode not null`. На чистой базе и в CI не проявляется. Починить: в
   `derive_profit_mode` не писать `null` в `profit_mode` (заменить на `coalesce(..., 'trip')`).
2. **Перевести остальные страницы на RLS-клиент** — ~88 файлов всё ещё идут через
   `service_role`, через них водитель видит больше, чем должен. Приоритет: водители,
   документы, расчёты. Страницы офиса удобно оставить на admin-клиенте.
3. **Разбивка гигантских файлов** (issue #13): два docx-роута (29.9 КБ / 27.9 КБ),
   домен forwarding (5 файлов 20–26 КБ), `app/today/page.tsx` (27.9 КБ),
   `app/page.tsx` (25.9 КБ), `CargoForm.tsx` (23.3 КБ). Ориентир — до ~500 строк / 15 КБ.
   Файлов крупнее 20 КБ всего 13.
4. **Проверить вход по логину через саму веб-форму** — после миграции `016` функция вызывается
   только через admin-клиент; клик по кнопке входа (фамилия водителя, имя менеджера) не проверялся.
5. **Сменить пароль менеджеру** (ANATOLI KURLIUK): до 13.11.2026 он лежал открытым текстом
   в `manager_passwords` и мог попасть в файлы бэкапов — считать скомпрометированным.
6. **Базовая миграция с полной схемой** — чтобы `supabase/stubs/schema.sql` можно было
   удалить, а `supabase db push` работал по-настоящему.
7. **Правила доступа для новых ролей** (логист, бухгалтерия, клиент) — когда понадобится:
   матрица готова, менять только `ROLE_CAPABILITIES`.

---

## 11. Шпаргалка по коду

- `next.config.js` — без ключа `eslint`, только `experimental`.
- `eslint.config.mjs` — `@eslint/js` + `typescript-eslint` + `react` + `react-hooks` + `globals`
  + готовый flat-конфиг `eslint-config-next`.
- `postcss.config.js` — только `@tailwindcss/postcss`.
- `proxy.ts` — проверка прав по capability; cron (`/api/cron/*`, по `CRON_SECRET`) и вебхуки публичные.
  Путь **без правила** в `PATH_CAPABILITIES` — только офис и менеджер; всем ролям открыты лишь
  `isOpenToAllRoles()` (`/`, `/driver/*`, `/login`, статика PWA). Новый файл в `public/`, который нужен
  водителю, — добавить в `OPEN_EXACT_PATHS`.
- Telegram водителя — одноразовая ссылка на 24 ч (кнопка «Создать ссылку» в карточке водителя);
  `?start=<driver_id>` больше не работает.
- `next.config.js` — заголовки безопасности (nosniff, X-Frame-Options, HSTS, Referrer-/Permissions-Policy).
- **Выборки из растущих таблиц — через `fetchAll` / `fetchAllByIds`** (`lib/fetch-all.ts`):
  PostgREST молча режет ответ на 1000 строк, а длинный `.in(ids)` падает по длине URL. Правило — в `AGENTS.md`.
- **Бэкап** (`/api/cron/backup`, 07:00 UTC): все таблицы → JSON → gzip → AES-256-GCM → файл
  `backup_*.json.gz.enc` в Telegram. Без `BACKUP_ENCRYPTION_KEY` не отправляется (алерт).
  Расшифровка: `BACKUP_ENCRYPTION_KEY='…' node scripts/decrypt-backup.mjs <файл>`.
  Новую таблицу — добавить в `TABLES` в роуте. Файлы из Storage (документы, фото) **не бэкапятся**.
- **Ограничение входа** (`lib/login-throttle*.ts`, таблица `login_failures`): 5 неудач на аккаунт или
  30 с одного IP за 15 минут — вход закрыт до выхода старой попытки из окна. Логин и IP — хэши.
  Ошибка БД → вход НЕ блокируется. Снять блок вручную: `delete from login_failures;`
- `exceljs` — в `dependencies`, ленивый импорт в клиентах, статический — в API.
- `npm audit` — 5 moderate (`postcss-selector-parser` через Tailwind) — принятый dev-риск.
- PWA — установка через «Добавить на главный экран».
- 🚨 **Vercel Hobby:** если после `git push` билды не запускаются — ждать 24 ч,
  либо `git commit --allow-empty -m "trigger" && git push`, либо ручной Redeploy.
