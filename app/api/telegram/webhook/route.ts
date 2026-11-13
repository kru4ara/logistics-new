import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from '../../../../lib/supabase/admin';

export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

// Сравнение секрета за постоянное время (хэшируем, чтобы длины совпали).
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function POST(request: Request) {
  // 1. Проверка секрета от Telegram (обязательно)
  if (!WEBHOOK_SECRET) {
    return NextResponse.json(
      { ok: false, error: 'TELEGRAM_WEBHOOK_SECRET is not configured' },
      { status: 500 }
    );
  }

  const incoming = request.headers.get('x-telegram-bot-api-secret-token');
  if (!incoming || !safeEqual(incoming, WEBHOOK_SECRET)) {
    console.warn('[telegram/webhook] Unauthorized: bad secret');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: any;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const message = update?.message;
  if (!message) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat?.id || '');
  const text = String(message.text || '').trim();

  if (!chatId) {
    return NextResponse.json({ ok: true });
  }

  // 2. Команда /start <token>
  //
  // Токен одноразовый (driver_telegram_links, миграция 017): ссылку создаёт
  // офис, срок жизни 24 часа. Раньше здесь был driver_id — постоянный
  // идентификатор, по которому кто угодно мог перепривязать уведомления.
  if (text.startsWith('/start')) {
    const token = text.split(/\s+/)[1];

    if (!token) {
      await sendMessage(
        chatId,
        '👋 Привет! Я бот Logistics CRM.\n\nЧтобы получать уведомления о новых рейсах, попросите у офиса персональную ссылку.'
      );
      return NextResponse.json({ ok: true });
    }

    const supabase = await createClient();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const nowIso = new Date().toISOString();

    // Атомарно «потребляем» токен: UPDATE сработает только один раз.
    const { data: link } = await supabase
      .from('driver_telegram_links')
      .update({ used_at: nowIso })
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gt('expires_at', nowIso)
      .select('driver_id')
      .maybeSingle();

    if (!link) {
      await sendMessage(
        chatId,
        '❌ Ссылка недействительна или устарела. Попросите офис прислать новую.'
      );
      return NextResponse.json({ ok: true });
    }

    const { data: driver } = await supabase
      .from('drivers')
      .select('id, first_name')
      .eq('id', link.driver_id)
      .maybeSingle();

    const { error } = await supabase
      .from('drivers')
      .update({ telegram_chat_id: chatId })
      .eq('id', link.driver_id);

    if (error || !driver) {
      console.error('[telegram/webhook] save chat_id error:', error);
      await sendMessage(chatId, '⚠️ Ошибка сохранения. Попросите офис прислать новую ссылку.');
      return NextResponse.json({ ok: true });
    }

    await sendMessage(
      chatId,
      `✅ Готово, ${driver.first_name || 'водитель'}!\n\nТеперь вы будете получать уведомления о новых рейсах.`
    );
    return NextResponse.json({ ok: true });
  }

  // 3. Любое другое сообщение — короткая подсказка
  await sendMessage(
    chatId,
    '🤖 Я бот Logistics CRM.\n\nПрисылаю уведомления о новых рейсах. Чтобы подключиться, попросите у офиса персональную ссылку и нажмите её.'
  );
  return NextResponse.json({ ok: true });
}

async function sendMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[telegram/webhook] TELEGRAM_BOT_TOKEN not set');
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[telegram/webhook] sendMessage failed:', res.status, body);
    }
  } catch (e) {
    console.error('[telegram/webhook] sendMessage exception:', e);
  }
}
