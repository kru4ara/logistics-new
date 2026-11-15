# Подключение новой компании (клиента)

Архитектура — `docs/MULTITENANCY_PLAN.md`: **у каждой компании свой проект Supabase и свой
проект Vercel**, код один — этот репозиторий. Здесь — пошагово, руками. После второго клиента
шаги 1–5 станут скриптом (`scripts/provision-tenant`, план 1.1).

Время: ~1 час. Нужны: доступ к организации Supabase (Pro) и к команде Vercel, Node.js 20+
и копия репозитория на компьютере (`git clone` + `npm ci`).

> Обозначения: `<client>` — короткое имя клиента латиницей (`acme`), `<domain>` — ваш домен
> для клиентов (`crm.example.com`). Всё, что помечено 🔐, — в менеджер паролей, запись `<client>`.

---

## Автоматически: `scripts/provision-tenant.mjs`

Шаги 1–3, 5 и 6 ниже — одной командой (~10 минут, из них ~3 — Supabase создаёт проект):

```bash
SUPABASE_ACCESS_TOKEN=…  SUPABASE_ORG=<slug организации>  VERCEL_TOKEN=…  [VERCEL_TEAM_ID=…] \
OPS_TELEGRAM_BOT_TOKEN=…  OPS_TELEGRAM_CHAT_ID=… \
node scripts/provision-tenant.mjs --name acme --domain crm.example.com \
     --office-email office@acme.pl --office-name "Jan Kowalski" --company "ACME Sp. z o.o." \
     --region eu-central-1 [--telegram-token <токен бота клиента>] [--telegram-chat-id …]
```

- Сначала `--dry-run`: покажет шаги и переменные окружения, ничего не создавая.
- Токены: Supabase → Account → Access Tokens; Vercel → Account Settings → Tokens. Репозиторий должен быть
  подключён к Vercel через GitHub-интеграцию.
- Регион — только ЕС; функции Vercel ставятся в тот же регион AWS (`eu-central-1` → `fra1`, `eu-west-1` → `dub1`).
- Секреты (пароль базы, service_role, CRON_SECRET, ключ бэкапа, пароль офиса) скрипт генерирует сам и пишет
  в `scripts/tenants/<name>.json` (в `.gitignore`, права 600) — **до** создания проекта, чтобы пароль базы
  не потерялся при сбое. Оттуда — в менеджер паролей.
- Упал на шаге — та же команда ещё раз: выполненные шаги пропускаются.
- В конце клиент сам добавляется в `scripts/tenants.json` — его сразу видят `migrate.mjs --all` и `tenants-status.mjs`.

Руками остаются: DNS у регистратора (CNAME), бот клиента у @BotFather (если клиент хочет Telegram),
передача клиенту входа и ключа бэкапа, проверка (§8). Ниже — те же шаги вручную, если API недоступен.

## 1. Проект Supabase

1. Supabase → организация → **New project**: имя `logistics-<client>`, **регион ЕС**
   (Frankfurt `eu-central-1` или Ireland `eu-west-1` — данные водителей по RODO должны быть в ЕС),
   пароль базы — сгенерировать 🔐.
2. **Project Settings → API** — записать:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key 🔐 → `SUPABASE_SERVICE_ROLE_KEY` (обходит RLS — только в Vercel и менеджере паролей)
3. **Connect → Connection string → URI → Session pooler** 🔐 — строка подключения для миграций.
4. **Authentication → Sign In / Providers → отключить «Allow new users to sign up».**
   Учётные записи создаёт только офис; иначе любой с публичным ключом заведёт себе вход.

## 2. Схема базы

```bash
DATABASE_URL='<строка Session pooler>' node scripts/migrate.mjs
DATABASE_URL='<строка Session pooler>' node scripts/migrate.mjs   # второй раз: «актуальна»
```

Создаёт всё: таблицы, политики RLS, функции, закрытый бакет `documents`, журнал миграций.
Реквизиты RAIBUILDING в новую базу **не попадают** (миграция 022 заполняет их только там,
где уже есть заказы).

Добавить клиента в `scripts/tenants.json` (файл в `.gitignore`, НЕ коммитить):
```json
[{ "name": "raibuilding", "url": "postgresql://…" }, { "name": "<client>", "url": "postgresql://…" }]
```

## 3. Первый пользователь офиса

1. **Authentication → Users → Add user → Create new user**: e-mail и пароль сотрудника клиента,
   ✅ Auto Confirm User. Триггер `on_auth_user_created` создаст профиль с ролью `driver`.
2. **SQL Editor** — сделать офисом:
   ```sql
   update public.profiles
      set role = 'office', full_name = 'Имя Фамилия'
    where id = (select id from auth.users where email = 'office@client.pl');
   ```

## 4. Telegram-бот клиента

У каждой компании свой бот: уведомления водителям, напоминания, бэкапы, алерты — в их чат.

1. Клиент (или вы с его согласия) в Telegram: **@BotFather → /newbot** → имя → username
   (`<client>_crm_bot`) → токен 🔐 → `TELEGRAM_BOT_TOKEN`.
2. Чат офиса: создать группу, добавить бота, написать в группу любое сообщение, открыть
   `https://api.telegram.org/bot<TOKEN>/getUpdates` → `chat.id` (у групп — отрицательное число)
   → `TELEGRAM_CHAT_ID`.
3. Секрет вебхука: `openssl rand -hex 32` 🔐 → `TELEGRAM_WEBHOOK_SECRET`.
4. Вебхук включить **после** деплоя (шаг 6).

## 5. Проект Vercel

1. Vercel → команда → **Add New → Project** → импорт `kru4ara/logistics-new`, ветка `master`.
2. **Environment Variables** (Production):

| Переменная | Значение |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | шаг 1.2 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | шаг 1.2 |
| `SUPABASE_SERVICE_ROLE_KEY` | шаг 1.2 🔐 |
| `NEXT_PUBLIC_APP_URL` | `https://<client>.<domain>` — для QR-кодов в заявках |
| `CRON_SECRET` | `openssl rand -hex 32` 🔐 — без него cron-задачи не запустятся |
| `BACKUP_ENCRYPTION_KEY` | `openssl rand -base64 32` 🔐 (44 символа, на конце `=`) |
| `TELEGRAM_BOT_TOKEN` | шаг 4.1 🔐 |
| `TELEGRAM_CHAT_ID` | шаг 4.2 |
| `TELEGRAM_WEBHOOK_SECRET` | шаг 4.3 🔐 |
| `LOGISAT_SERVER` / `LOGISAT_USERNAME` / `LOGISAT_PASSWORD` | только если у клиента GPS Logisat 🔐 |
| `FAKTUROWNIA_DOMAIN` / `FAKTUROWNIA_API_TOKEN` | только если клиент выставляет фактуры через Fakturownia: поддомен (`firma` из `firma.fakturownia.pl`) и токен из Ustawienia → Ustawienia konta → Integracja → Kod autoryzacyjny API 🔐. KSeF подключается в самой Fakturownia |
| `TENANT_NAME` | `<client>` — имя компании в оповещениях о сбоях |
| `OPS_TELEGRAM_BOT_TOKEN` / `OPS_TELEGRAM_CHAT_ID` | **ваш** бот и чат поддержки — одинаковые во всех проектах 🔐 (см. ниже) |

3. Регион функций берётся из `vercel.json` (`dub1`, Дублин — рядом с базой в `eu-west-1`). Если база клиента во Франкфурте (`eu-central-1`) — поставить `fra1` в **Settings → Functions → Function Region**. Без этого функции работают в США (`iad1`): данные водителей уходят за пределы ЕС, а каждый запрос к базе пересекает океан.
4. **Deploy.** Cron-задачи (бэкап, напоминания, курсы валют) подхватятся из `vercel.json` сами.
5. **Settings → Domains** → `<client>.<domain>` → у регистратора домена: CNAME на `cname.vercel-dns.com`.

## 6. Вебхук Telegram

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<client>.<domain>/api/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```
Ответ `{"ok":true,…}`.

## 7. Настройки компании

Войти под пользователем из шага 3 → **Настройки компании** (`/settings`):
- реквизиты, банк и счета, e-mail;
- **условия перевозки — текст клиента** (условия RAIBUILDING — ваш юридический текст, не копировать
  без согласования); подстановки `{payment_days}`, `{documents}`, `{email}`;
- печать (PNG с прозрачным фоном);
- имя Telegram-бота из шага 4.1 (без `@`); «домен старых логинов» — пусто.

### Оповещения о сбоях (один раз для всех клиентов)

Сбои на сервере у любого клиента приходят **вам**, а не клиенту: `instrumentation.ts` →
`lib/error-alerts.ts`. В сообщении — компания, страница (без query-строки), текст ошибки и `digest`
для поиска в логах Vercel; данных пользователя (cookie, заголовков) нет. Одинаковая ошибка —
не чаще раза в 30 минут. Ошибки в браузере пользователя (кнопки, формы, сбой отрисовки) приходят туда же с пометкой
`BROWSER · client` и ролью пользователя — через `app/api/client-error`.

1. @BotFather → `/newbot` → бот поддержки (`<ваше-имя>_ops_bot`) → токен 🔐 → `OPS_TELEGRAM_BOT_TOKEN`.
2. Написать боту `/start`, открыть `https://api.telegram.org/bot<TOKEN>/getUpdates` → `chat.id` → `OPS_TELEGRAM_CHAT_ID`.
3. Эти две переменные — в каждый проект Vercel; `TENANT_NAME` — своё у каждого. Без них оповещения выключены.

## 8. Проверка

- [ ] вход офиса; на странице входа — название клиента, не RAIBUILDING;
- [ ] водитель: карточка → Telegram «Создать ссылку» → ссылка на бота клиента → `/start` привязывает;
- [ ] рейс → заявка DOCX: реквизиты, условия и печать клиента;
- [ ] рейс → загрузить файл → открывается (временная ссылка);
- [ ] Vercel → Cron Jobs → `/api/cron/backup` → **Run**: в чате клиента `backup_….json.gz.enc`, «Ошибок нет»;
      расшифровать: `BACKUP_ENCRYPTION_KEY='…' node scripts/decrypt-backup.mjs <файл>`;
- [ ] `DATABASE_URL='…' node scripts/migrate.mjs --dry-run` → «актуальна».

Ключ бэкапа — договориться, у кого он: у клиента (его данные) и копия у вас 🔐 для восстановления
по его просьбе. Без ключа бэкап не расшифровать никому.

---

## Обновления для всех клиентов

1. Мерж в `master` → **все** проекты Vercel деплоятся сами (подключены к одному репозиторию).
2. Дождаться деплоя → миграции на все базы:
   ```bash
   node scripts/migrate.mjs --all scripts/tenants.json --dry-run   # что будет применено
   node scripts/migrate.mjs --all scripts/tenants.json
   ```
   Ошибка на одной базе не останавливает остальные; в конце — сводка.
3. Миграция, которая убирает то, чем пользуется **старый** код, — только после деплоя
   (см. `docs/HANDOVER.md`, «Миграции»).

## Обслуживание: сводка по всем клиентам

```bash
node scripts/tenants-status.mjs scripts/tenants.json
```

Только чтение. По каждому клиенту: версия схемы (и сколько миграций не применено), когда был
последний бэкап, сколько заказов, водителей и пользователей, когда кто-то последний раз входил.

```
   клиент       схема         бэкап  заказов  водителей  польз.  вход   замечания
✅  raibuilding  20261114_024  5 ч    1240     18         6       20 мин
❌  acme         20261114_022  3 дн   85       4          2       2 дн   бэкап 3 дн. назад; не применено миграций: 2
```

❌ — бэкапа нет больше 26 часов или база недоступна; ⚠️ — не применены миграции
(`node scripts/migrate.mjs --all scripts/tenants.json`). Код выхода 1 при ❌ — удобно для расписания.
«Вход» помогает заметить клиента, который перестал пользоваться системой.
