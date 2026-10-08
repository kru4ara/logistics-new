// Хелпер для отправки алертов об ошибках cron-задач в общий Telegram-чат офиса.
// Использование:
//   await sendCronAlert('backup', 'DB connection failed: ...');
//   await sendCronSummary('backup', 'Не выгружены таблицы: trip_expenses, clients');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function nowUtc(): { date: string; time: string } {
  const iso = new Date().toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

async function sendMarkdown(text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('[cron-alert] Telegram env not set, cannot send alert');
    return false;
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
        cache: 'no-store',
      }
    );
    if (!res.ok) {
      const body = await res.text();
      console.error('[cron-alert] send failed:', res.status, body);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[cron-alert] exception:', e);
    return false;
  }
}

/**
 * Критический алерт — cron полностью упал (не выполнил основную работу).
 */
export async function sendCronAlert(
  cronName: string,
  details: string,
): Promise<boolean> {
  const { date, time } = nowUtc();
  const text = [
    `🔴 *Cron упал*: \`${cronName}\``,
    `📅 ${date} ${time} UTC`,
    '',
    '```',
    details.slice(0, 900),
    '```',
  ].join('\n');
  return sendMarkdown(text);
}

/**
 * Предупреждение — cron выполнил основную работу, но с проблемами
 * (часть данных не выгружена, часть сообщений не отправлена и т.п.)
 */
export async function sendCronSummary(
  cronName: string,
  summary: string,
): Promise<boolean> {
  const { date, time } = nowUtc();
  const text = [
    `⚠️ *Cron завершён с проблемами*: \`${cronName}\``,
    `📅 ${date} ${time} UTC`,
    '',
    summary.slice(0, 1500),
  ].join('\n');
  return sendMarkdown(text);
}
