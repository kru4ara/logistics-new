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
- RLS включён, все публичные политики на `drivers` и `users` удалены.
- `app/components/DocumentUpload.tsx` — на server action.
- `app/driver/telegram-actions.ts` — мёртвый импорт убран.

### Схема БД (изменения)
- `documents`: удалены колонки `driver_id`, `truck_id` (используется только `entity_type` + `entity_id`).
- `user_roles`: удалена целиком (пустая, не использовалась).
- `forwarding_orders`: удалены `contractor_id`, `contractor_price_eur`, `original_contractor_price` (дубли из `forwarding_contractors`).
- `created_at` / `uploaded_at` / `last_notified_at`: приведены к `timestamptz` в `clients`, `documents`, `drivers`, `locations`, `reminders`, `trip_expenses`, `trucks`.
- Индексы на FK: `trips.*`, `trip_expenses.trip_id`, `trip_documents.trip_id`, `documents.*`, `forwarding_points.location_id` (11 штук).

### UI / UX
- `app/components/SubmitButton.tsx` — универсальная submit-кнопка с pending-состоянием. Подключена во все ключевые формы (создание/редактирование рейсов, клиентов, подрядчиков, локаций, экспедирования, расходов, телеметрии).
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

## Открытые задачи
- Шаг 11: автообновление курсов PLN/BYN (NBP API + cron в Vercel).
- Опционально: `trips.start_date` / `end_date` → тип `date`.
- Опционально: дашборд с KPI на главной.
- Опционально: экспорт в Excel (библиотека `xlsx` уже в зависимостях).

## Что НЕ трогать без причины
- `lib/supabase-server.ts` — service_role, обходит RLS. Импортировать только на сервере.
- `lib/supabaseClient.ts` — старый клиентский клиент, лежит на всякий случай, нигде не используется.
- RLS-политики: сейчас закрыты. Если что-то в БД не читается — скорее всего это клиентский запрос.
