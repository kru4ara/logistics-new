# HANDOVER — Logistics CRM (актуально на 04.10.2026)

## Стек и инфраструктура
- Next.js 14 (App Router) + Supabase + Vercel
- GitHub: kru4ara/logistics-new (ветка master)
- Prod: https://logistics-new-ebon.vercel.app
- Supabase Project ID: smodijsjwcvsscfgloh
- Vercel project: kru4aras-projects/logistics-new

## ENV-переменные (Vercel → Settings → Environment Variables)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — для клиента, RLS закрыт
- `SUPABASE_SERVICE_ROLE_KEY` — серверный клиент, обходит RLS
- `LOGISAT_SERVER`, `LOGISAT_USERNAME`, `LOGISAT_PASSWORD`
- `TELEGRAM_BOT_TOKEN` — токен бота @raibuilding_bot (отозван 04.10, заменён на новый)
- `TELEGRAM_CHAT_ID` — чат офиса для общих уведомлений
- `TELEGRAM_WEBHOOK_SECRET` — секрет для webhook
- `CRON_SECRET` — секрет для cron

**ВАЖНО:** Vercel Secret-переменные **нельзя редактировать** — только удалить и создать заново. Это касается `TELEGRAM_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.

## Правила работы
- Полные файлы на замену (не куски) — пользователь просил присылать файлы целиком, чтобы не искать блоки
- 1 шаг за раз, с проверкой между шагами
- Мобильная адаптация: `px-4 md:px-6`, `p-5 md:p-6`, `text-base` в инпутах
- Серверные компоненты → `createClient()` из `lib/supabase-server` (service_role)
- Клиентского Supabase-клиента в проекте больше нет (кроме `lib/supabaseClient.ts`, не используется)

## Сделано (важное)

### Безопасность
- Пароли: bcrypt-хеши в `password_hash`. Колонка `password` удалена.
- Логин: server action + `bcrypt.compare` + httpOnly cookie + задержка 500 мс при ошибке.
- Logout: server action.
- Навбар: серверный (`app/components/Navbar.tsx`) + клиентская часть (`NavbarClient.tsx`).
- RLS включён на всех 18 таблицах. **Все публичные политики удалены** (инспекция 02.10).
- `DocumentUpload` → server action.
- Удалены мёртвые файлы: `rates-actions.ts`, `LogoutButton.tsx`, `Map.tsx`.
- Telegram-токен отозван и заменён (03-04.10) после случайной утечки в чате.

### Схема БД
- `documents`: удалены `driver_id`, `truck_id`.
- `user_roles`: удалена.
- `forwarding_orders`: удалены `contractor_id`, `contractor_price_eur`, `original_contractor_price`.
- `timestamptz` унификация: `clients`, `documents`, `drivers`, `locations`, `reminders`, `trip_expenses`, `trucks`.
- Индексы на FK (11 штук).
- `drivers.telegram_chat_id` — для персональных уведомлений.
- `audit_log` — журнал изменений (id, created_at, user_role, user_id, user_name, entity_type, entity_id, action, changes jsonb, summary).

### UI / UX
- `SubmitButton` — во всех ключевых формах.
- `Toaster` + `error.tsx` + `global-error.tsx`.
- Тосты через `?toast=...` в редиректах.
- Глобальный поиск (`/search?q=...`) — по рейсам, экспедированию, клиентам, подрядчикам, водителям.
- Экспорт в Excel (`/reports/excel`) — 4 выгрузки: рейсы, расходы рейсов, экспедирование, прибыльность клиентов. Ссылка из `/reports`.
- Журнал изменений (`/audit`) — фильтры по типам сущностей, diff изменений, русские названия полей.

### Бизнес-логика
- Остаток топлива: допуск `-200 л`, жёлтый/красный по порогам.
- Авто-дата старта нового рейса: `end_date` предыдущего рейса машины + 1 день.
- Logisat: устойчивый парсинг дат, `stage` в ответе. `/driver/logisat`.
- DOCX подрядчику: `Kraj`, `GPS`, `Kontakt`, `Uwagi`.
- Подрядчики: поле `country`.
- Форма экспедирования: `PointRow` вынесен наружу (баг с фокусом).
- Автоматический пересчёт курсов валют через `/api/update-rates` (cron 06:00 UTC).

### Telegram-уведомления
- Бот: **@raibuilding_bot**.
- Webhook: `/api/telegram/webhook` — обрабатывает `/start <driver_id>`, сохраняет `telegram_chat_id`.
- Персональная ссылка: `https://t.me/raibuilding_bot?start=<driver_id>` — в карточке водителя (`TelegramLinkCard.tsx`).
- Уведомления:
  - Водителю при создании рейса (`geocode-actions.ts` → `notifyDriverAboutNewTrip`).
  - В общий чат офиса при смене статуса рейса (`trip-status-actions.ts`).
  - В общий чат при загрузке документа (`upload-actions.ts`).

**Подводные камни Telegram:**
- Vercel Secret-переменные не редактируются — только удалить/создать.
- После смены токена — обязательно Redeploy, иначе ENV не подхватится.
- Webhook привязан к боту, а не к токену. При смене токена webhook переустанавливать НЕ надо.
- При настройке webhook используется параметр `secret_token` = `TELEGRAM_WEBHOOK_SECRET`. Проверяется в роуте по заголовку `x-telegram-bot-api-secret-token`.

### Аудит-лог (полное покрытие, 04.10.2026)
- `lib/audit.ts` → `logAudit()`, `diffFields()`. Ошибки логируются в `console.error`, но не ломают бизнес-логику.
- Покрытие:
  - **Рейсы**: create, update, delete, status_change (`trip-actions.tsx`, `geocode-actions.ts`, `trip-status-actions.ts`)
  - **Расходы рейсов**: create, delete (`trip-actions.tsx`)
  - **Клиенты**: create, update, delete (`client-actions.ts`, `clients/new/page.tsx`)
  - **Водители**: create, update (`driver-actions.ts`, `drivers/new/page.tsx`)
  - **Подрядчики**: create, update, delete (`contractors/actions.ts`)
  - **Локации**: create, update, delete (`locations/actions.ts`)
  - **Экспедирование**: create, update, delete, status_change (`forwarding/actions.ts`)
  - **Расходы экспедирования**: create, delete (`forwarding/expense-actions.ts`)
- Страница `/audit` — фильтры по сущностям, показ diff'ов, форматирование дат DD.MM.YYYY, русские названия полей.
- **Не покрыто:** напоминания (`reminders/actions.ts`), документы (`document-actions.ts`, `upload-actions.ts`). Низкий приоритет.

## Cron (Vercel `vercel.json`)
- `/api/update-rates` — `0 6 * * *` — курсы PLN/BYN через `open.er-api.com`.
- `/api/cron/reminders` — `0 9 * * *` — рассылка напоминаний в Telegram.

## Открытые задачи (не сделано)
- **Отчёт «Прибыльность клиентов и машин»** — сводка: кто приносит деньги, какие машины окупаются. Данные есть. ~3 часа.
- **Экспорт для водителя** — своя страница `/driver/reports` (рейсы, км, топливо, зарплата за месяц). ~1 час.
- **PWA + камера для водителя** — фото CMR прямо из браузера. ~2–3 часа.
- **Тесты на критичные места** — расчёт топлива, Logisat, DOCX. ~3–4 часа.
- **Аудит: напоминания и документы** — доделать покрытие. ~30 минут.
- **Мелочь:** в `summary` при создании экспедирования `unload_date` показывается в ISO — поправить на DD.MM.YYYY.
- **Унификация дублей:** `client-actions.ts` + `clients/new/page.tsx` (inline `createClient`).
- **Опционально:** `trips.start_date` / `end_date` → тип `date`.

## Известные подводные камни

### PostgREST и двусмысленные FK
У `trips` **два** FK на `trucks`: `truck_id` (тягач) и `trailer_id` (прицеп). Везде, где идёт join с `trucks`, **обязательно** указывать алиас:
```ts
.select('*, trucks!truck_id(registration_number), trucks!trailer_id(registration_number)')
