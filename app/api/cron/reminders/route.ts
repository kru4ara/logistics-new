import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const CRON_SECRET = process.env.CRON_SECRET;

// Дни, в которые отправляем уведомление (за N дней до срока)
const NOTIFY_DAYS = new Set([30, 14, 7, 3, 1, 0]);

function getDaysUntil(dateString: string | null): number | null {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateString);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDaysLeft(d: number): string {
  if (d === 0) return '⚠️ СРОК СЕГОДНЯ!';
  if (d === 1) return '⚠️ Остался 1 день';
  if (d < 0) return `🔴 Просрочено ${Math.abs(d)} дн.`;
  return `⏳ Осталось ${d} дн.`;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU');
}

async function sendTelegram(text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;

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
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  // Защита: если CRON_SECRET задан — проверяем заголовок
  if (CRON_SECRET) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return NextResponse.json(
      { success: false, error: 'TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы' },
      { status: 500 }
    );
  }

  const supabase = await createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  // Загружаем все активные напоминания
  const { data: reminders, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('status', 'active')
    .not('due_date', 'is', null);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  const log: Array<{ id: string; title: string; daysLeft: number | null; action: string }> = [];

  for (const r of reminders || []) {
    const daysLeft = getDaysUntil(r.due_date);

    if (daysLeft === null) {
      skipped++;
      continue;
    }

    let shouldNotify = false;

    if (daysLeft < 0) {
      // Просроченные — раз в день
      const lastNotified = r.last_notified_at ? new Date(r.last_notified_at) : null;
      if (!lastNotified || lastNotified < today) {
        shouldNotify = true;
      }
    } else if (NOTIFY_DAYS.has(daysLeft)) {
      // Ключевые дни — только если ещё не отправляли на этом этапе
      if (r.last_notified_days !== daysLeft) {
        shouldNotify = true;
      }
    }

    if (!shouldNotify) {
      skipped++;
      continue;
    }

    // Формируем текст
    const emoji = r.category === 'insurance' ? '🛡' :
                  r.category === 'inspection' ? '🔧' :
                  r.category === 'driver_doc' ? '📄' :
                  r.category === 'payment_to_contractor' ? '🚛' :
                  r.category === 'accounting' ? '💰' : '📌';

    const isAuto = r.entity_type !== null;
    const lines: string[] = [];
    lines.push(`${emoji} *Напоминание*`);
    lines.push('');
    lines.push(`*${r.title}*`);
    lines.push(`📅 Дата: ${formatDate(r.due_date)}`);
    lines.push(formatDaysLeft(daysLeft));
    if (r.amount) {
      lines.push(`💰 Сумма: ${r.amount} €`);
    }
    if (isAuto) {
      lines.push('');
      lines.push(`_🔒 Автоматическое (${r.entity_type === 'driver' ? 'водитель' : 'машина'})_`);
    }

    const text = lines.join('\n');

    const ok = await sendTelegram(text);

    if (ok) {
      // Обновляем поле last_notified
      await supabase
        .from('reminders')
        .update({
          last_notified_at: todayISO,
          last_notified_days: daysLeft,
        })
        .eq('id', r.id);

      sent++;
      log.push({ id: r.id, title: r.title, daysLeft, action: 'sent' });
    } else {
      log.push({ id: r.id, title: r.title, daysLeft, action: 'tg_error' });
    }

    // Небольшая пауза, чтобы не превысить лимиты Telegram
    await new Promise((res) => setTimeout(res, 100));
  }

  return NextResponse.json({
    success: true,
    total: reminders?.length || 0,
    sent,
    skipped,
    timestamp: new Date().toISOString(),
    log: log.slice(0, 20), // первые 20 записей для диагностики
  });
}
