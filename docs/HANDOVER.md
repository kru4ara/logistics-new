# HANDOVER — Logistics CRM (актуально на 03.10.2026)

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
- `TELEGRAM_BOT_TOKEN` — токен бота @raibuilding_bot
- `TELEGRAM_CHAT_ID` — чат офиса для общих уведомлений
- `TELEGRAM_WEBHOOK_SECRET` — секрет для webhook (любая строка)
- `CRON_SECRET` — секрет для cron

## Правила работы
- Полные файлы на замену (не куски)
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

### Схема БД
- `documents`: удалены `driver_id`, `truck_id`.
- `user_roles`: удалена.
- `forwarding_orders`: удалены `contractor_id`, `contractor_price_eur`, `original_contractor_price`.
- `timestamptz` унификация: `clients`, `documents`, `drivers`, `locations`, `reminders`, `trip_expenses`, `trucks`.
- Индексы на FK (11 штук).
- `drivers.telegram_chat_id` — для персональных уведомлений.
- `audit_log` — журнал изменений.

### UI / UX
- `SubmitButton` — во всех ключевых формах.
- `Toaster` + `error.tsx` + `global-error.tsx`.
- Тосты через `?toast=...`.
- Глобальный поиск (`/search?q=...`) — по рейсам, экспедированию, клиентам, подрядчикам, водителям.
- Экспорт в Excel (`/reports/excel`) — 4 выгрузки: рейсы, расходы рейсов, экспедирование, прибыльность клиентов.
- Журнал изменений (`/audit`) — фильтры по типам сущностей.

### Бизнес-логика
- Остаток топлива: допуск `-200 л`, жёлтый/красный по порогам.
- Авто-дата старта нового рейса: `end_date` предыдущего рейса машины + 1 день.
- Logisat: устойчивый парсинг дат, `stage` в ответе. `/driver/logisat`.
- DOCX подрядчику: `Kraj`, `GPS`, `Kontakt`, `Uwagi`.
- Подрядчики: поле `country`.
- Форма экспедирования: `PointRow` вынесен наружу (баг с фокусом).

### Telegram-уведомления (03.10.2026)
- Бот: **@raibuilding_bot** (username).
- Webhook: `/api/telegram/webhook` — обрабатывает `/start <driver_id>` от водителей, сохраняет `telegram_chat_id`.
- Персональная ссылка: `https://t.me/raibuilding_bot?start=<driver_id>` — генерируется в карточке водителя (`TelegramLinkCard.tsx`).
- Уведомления отправляются:
  - Водителю при создании рейса (`geocode-actions.ts` → `notifyDriverAboutNewTrip`).
  - В общий чат офиса при смене статуса рейса (`trip-status-actions.ts`).
  - В общий чат при загрузке документа (`upload-actions.ts`).
- **Известные подводные камни:**
  - Vercel Secret-переменные (тип Secret) **не редактируются** — только удалить и создать заново.
  - У `trips` два FK на `trucks` (`truck_id` и `trailer_id`). Везде, где идёт join с trucks, обязательно указывать `trucks!truck_id(...)` или `trucks!trailer_id(...)`, иначе PostgREST возвращает ошибку «more than one relationship found», и `data = null` без явной ошибки.

### Аудит-лог (03.10.2026)
- Таблица `audit_log`: `id`, `created_at`, `user_role`, `user_id`, `user_name`, `entity_type`, `entity_id`, `action`, `changes` (jsonb), `summary`.
- `lib/audit.ts` → `logAudit()`, `diffFields()`.
- Логируется: рейсы (create/update/delete/status_change), расходы рейсов (create/delete), клиенты (CRUD).
- Страница `/audit` — фильтры по сущностям, показ diff'ов.
- Пункт «📜 Аудит» в навбаре.

## Cron (Vercel `vercel.json`)
- `/api/update-rates` — `0 6 * * *` — курсы PLN/BYN через `open.er-api.com`.
- `/api/cron/reminders` — `0 9 * * *` — рассылка напоминаний в Telegram.

## Открытые задачи

### Срочное
- **Отозвать Telegram-токен** (был в переписке 03.10). BotFather → Revoke → заменить в Vercel → Redeploy. Webhook не переустанавливать.

### Не сделано
- Аудит: расширить на водителей, подрядчиков, локации, экспедирование, напоминания.
- Экспорт для водителя (свой отчёт по рейсам за месяц).
- Отчёт «Прибыльность клиентов и машин».
- PWA + камера для водителя (фото CMR из браузера).
- Тесты на критичные места (расчёт топлива, Logisat, DOCX).
- Унификация дублей: `client-actions.ts` + `clients/new/page.tsx`.
- Опционально: `trips.start_date` / `end_date` → тип `date`.

## Что НЕ трогать без причины
- `lib/supabase-server.ts` — service_role, обходит RLS. Только на сервере.
- `lib/supabaseClient.ts` — старый клиентский клиент, не используется.
- RLS-политики: закрыты. Если что-то не читается — это клиентский запрос.

## Отладка на будущее

Если что-то падает в server actions:
1. Vercel → **Logs**. Вкладки «Runtime» может не быть — переключите фильтр вверху.
2. `console.log` из server actions виден в общих логах, но **фильтруется** — используйте `console.error` для гарантии.
3. Если видите `[audit]` или `[changeTripStatus]` в логах — код точно выполняется.
