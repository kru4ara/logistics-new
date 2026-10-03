// ============================================================
// Единая отправка уведомлений в Telegram.
// Используется во всех server actions для уведомлений о событиях.
// ============================================================

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

type TelegramOptions = {
  chatId?: string;
  parseMode?: 'Markdown' | 'HTML' | '';
};

/**
 * Отправляет текстовое сообщение в Telegram.
 * Возвращает true при успехе, false при ошибке (не бросает исключение —
 * уведомление не должно ломать основную бизнес-логику).
 */
export async function notifyTelegram(
  text: string,
  options: TelegramOptions = {}
): Promise<boolean> {
  const token = TELEGRAM_BOT_TOKEN;
  const chatId = options.chatId ?? TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    // Молча выходим: env не настроены — это не ошибка приложения
    return false;
  }

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (options.parseMode) {
    payload.parse_mode = options.parseMode;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      const body = await res.text();
      console.error('[telegram] send failed:', res.status, body);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[telegram] exception:', e);
    return false;
  }
}

// ============================================================
// Экспорт объекта с chatId — иногда нужно для групповых чатов
// ============================================================
export const DEFAULT_TELEGRAM_CHAT_ID = TELEGRAM_CHAT_ID;
