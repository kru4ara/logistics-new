// Cron курсов валют. Лежит под /api/cron/*, чтобы proxy.ts пропускал запрос
// Vercel Cron без пользовательской сессии (CRON_SECRET он проверяет сам).
// Раньше cron бил в /api/update-rates, где proxy требует сессию и право
// rates.manage, — запрос получал 401 до того, как доходил до роута.
// Логика остаётся в одном месте: /api/update-rates (ручной запуск из UI).
export const dynamic = 'force-dynamic';
export { GET } from '../../update-rates/route';
