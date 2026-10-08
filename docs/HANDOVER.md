# HANDOVER — Logistics CRM (08.10.2026)

## Стек и инфраструктура
- Next.js 14 (App Router) + Supabase + Vercel
- GitHub: kru4ara/logistics-new (master) — автокоммит на каждое изменение файла
- Prod: https://logistics-new-ebon.vercel.app
- Supabase Project: smodijsjwcvsscfgloh
- Vercel project: kru4aras-projects/logistics-new

## ENV (Vercel → Settings → Environment Variables)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY — для клиента, RLS закрыт
- SUPABASE_SERVICE_ROLE_KEY — server client, обходит RLS
- LOGISAT_SERVER / LOGISAT_USERNAME / LOGISAT_PASSWORD
- TELEGRAM_BOT_TOKEN — токен @raibuilding_bot (отозван 04.10, обновлён)
- TELEGRAM_CHAT_ID — общий чат офиса
- TELEGRAM_WEBHOOK_SECRET — секрет для webhook
- CRON_SECRET — секрет для cron (обновлён 04.10)

**Vercel Secret-переменные не редактируются** — только удалить + создать заново. После замены — обязателен Redeploy.

## Правила работы
- **Полные файлы на замену, не куски** — пользователь просил не давать фрагменты
- 1 шаг за раз, с проверкой между шагами
- Мобильная адаптация: `px-4 md:px-6`, `p-5 md:p-6`, `text-base` в инпутах
- Server components → `createClient()` из `lib/supabase-server`
- Клиентского supabase-клиента в проекте больше нет (легаси `lib/supabaseClient.ts` остался, но не используется)
- **Внимательно с путями импорта:** сколько уровней вложенности — столько `../`. `app/driver/stats/page.tsx` → `../../../lib/...`. `app/driver/page.tsx` → `../../lib/...`

---

## 📁 Структура проекта (карта)
