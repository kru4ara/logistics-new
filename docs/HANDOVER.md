# HANDOVER — Logistics CRM (актуально на 02.10.2026)

## Стек и инфраструктура
- Next.js 14 (App Router) + Supabase + Vercel
- GitHub: kru4ara/logistics-new (ветка master)
- Prod: https://logistics-new-ebon.vercel.app
- Supabase Project ID: smodijsjwcvsscfgloh
- Vercel project: kru4aras-projects/logistics-new

## ENV-переменные (Vercel → Settings → Environment Variables)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — только для клиента, RLS закрыт
- `SUPABASE_SERVICE_ROLE_KEY` — серверный клиент, обходит RLS
- `LOGISAT_SERVER`, `LOGISAT_USERNAME`, `LOGISAT_PASSWORD`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

## Правила работы
- Полные файлы на замену (не куски)
- 1 шаг за раз, с проверкой между шагами
- Мобильная адаптация: `px-4 md:px-6`, `p-5 md:p-6`, `text-base` в инпутах
- Серверные компоненты → `createClient()` из `lib/supabase-server` (service_role)
- Клиентского Supabase-клиента в проекте больше нет (кроме определения `lib/supabaseClient.ts`)

## Сделано (важное)

### Безопасность
- Пароли водителей и админа: bcrypt-хеши в `password_hash`. Колонка `password` удалена.
- Логин: server action `app/login/actions.ts` + bcrypt.compare + httpOnly cookie (role, driver_id, user_name) + задержка 500 мс при ошибке.
- Logout: server action.
- Навбар: серверный (`app/components/Navbar.tsx`) + клиентская часть (`app/components/NavbarClient.tsx`).
- RLS включён на всех 18 таблицах. **Все открытые публичные политики удалены** (инспекция 02.10).
- `app/components/DocumentUpload.tsx` — на server action.
- `app/driver/telegram-actions.ts` — мёртвый импорт убран.

### Схема БД (изменения)
- `documents`: удалены колонки `driver_id`, `truck_id` (используется только `entity_type` + `entity_id`).
- `user_roles`: удалена целиком (пустая, не использовалась).
- `forwarding_orders`: удалены `contractor_id`, `contractor_price_eur`, `original_contractor_price` (дубли из `forwarding_contractors`).
- `created_at` / `uploaded_at` / `last_notified_at`: приведены к `timestamptz` в `clients`, `documents`, `drivers`, `locations`, `reminders`, `trip_expenses`, `trucks`.
- Индексы на FK: `trips.*`, `trip_expenses.trip_id`, `trip_documents.trip_id`, `documents.*`, `forwarding_points.location_id` (11 штук).

### UI / UX
- `app/components/SubmitButton.tsx` — универсальная submit-кнопка с pending-состоянием. Подключена во все ключевые формы.
- `app/components/Toaster.tsx` + `app/error.tsx` + `app/global-error.tsx`.
- Тосты через `?toast=...` в редиректах server actions. Словарь ключей в `Toaster.tsx`.
- `app/search/` — глобальный поиск (`/search?q=...`) по рейсам, экспедированию, клиентам, подрядчикам, водителям. Поле поиска в навбаре, только для офиса.

### Бизнес-логика
- Остаток топлива: допуск `-200 л` (`NEGATIVE_FUEL_TOLERANCE`), жёлтый/красный по порогам.
- Авто-дата старта нового рейса: `end_date` предыдущего рейса машины + 1 день. Если `end_date` пустой — не подставляется.
- Logisat: `lib/logisat.ts` — устойчивый парсинг дат, `stage` в ответе. `/driver/logisat` — просмотр расхода по машине и периоду.
- DOCX подрядчику: добавлены `Kraj`, `GPS`, `Kontakt`, `Uwagi`.
- Подрядчики: поле `country` (селект из `EUROPEAN_COUNTRIES`).
- Форма экспедирования: `PointRow` вынесен наружу — баг «по 1 букве» устранён.

### Инспекция 02.10.2026 — фиксы
- Удалены мёртвые файлы: `app/rates-actions.ts`, `app/LogoutButton.tsx`, `app/Map.tsx`.
- Проверены живые «подозрительные»: `app/reminder-actions.ts` (syncReminders), `app/client-actions.ts`, `app/driver-actions.ts`, `app/truck-actions.ts`, `app/trip-actions.tsx` — все используются, оставлены.
- Удалены ВСЕ открытые публичные RLS-политики с `clients`, `contractors`, `documents`, `fixed_costs`, `forwarding_*`, `locations`, `rates`, `reminders`, `trip_*`, `trips`, `trucks`. Осталось 0 политик на `public`.

## Cron (Vercel `vercel.json`)
- `/api/update-rates` — `0 6 * * *` — обновляет курсы PLN/BYN через `open.er-api.com`
- `/api/cron/reminders` — `0 9 * * *` — рассылка напоминаний через Telegram

## Открытые задачи (что осталось)
- Экспорт в Excel (рейсы, расходы, экспедирование, прибыльность) — библиотека `xlsx` в зависимостях, не используется.
- Аудит-лог (кто и когда менял данные) — на будущее.
- Telegram-уведомления по событиям (начат/завершён рейс, загружен CMR).
- PWA + камера для водителя (фото CMR прямо из приложения).
- Тесты на критичные места (расчёт топлива, Logisat, DOCX).
- Унификация дублей: `client-actions.ts` + `clients/new/page.tsx` (встроенный `createClient`) — два места для создания клиента.
- Опционально: `trips.start_date` / `end_date` → тип `date`.

## Что НЕ трогать без причины
- `lib/supabase-server.ts` — service_role, обходит RLS. Импортировать только на сервере.
- `lib/supabaseClient.ts` — старый клиентский клиент, лежит на всякий случай, нигде не используется.
- RLS-политики: сейчас закрыты. Если что-то в БД не читается — скорее всего это клиентский запрос.
