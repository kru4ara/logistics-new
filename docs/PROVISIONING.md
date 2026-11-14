# Подключение новой компании (клиента)

Архитектура — `docs/MULTITENANCY_PLAN.md`: **у каждой компании свой проект Supabase и свой
проект Vercel**, код один — этот репозиторий. Здесь — пошагово, руками. После второго клиента
шаги 1–5 станут скриптом (`scripts/provision-tenant`, план 1.1).

Время: ~1 час. Нужны: доступ к организации Supabase (Pro) и к команде Vercel, Node.js 20+
и копия репозитория на компьютере (`git clone` + `npm ci`).

> Обозначения: `<client>` — короткое имя клиента латиницей (`acme`), `<domain>` — ваш домен
> для клиентов (`crm.example.com`). Всё, что помечено 🔐, — в менеджер паролей, запись `<client>`.

---

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

3. **Deploy.** Cron-задачи (бэкап, напоминания, курсы валют) подхватятся из `vercel.json` сами.
4. **Settings → Domains** → `<client>.<domain>` → у регистратора домена: CNAME на `cname.vercel-dns.com`.

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
