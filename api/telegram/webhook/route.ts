import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

export async function POST(request: Request) {
  // 1. Проверка секрета от Telegram
  if (WEBHOOK_SECRET) {
    const incoming = request.headers.get('x-telegram-bot-api-secret-token');
    if (incoming !== WEBHOOK_SECRET) {
      console.warn('[telegram/webhook] Unauthorized: bad secret');
      return NextResponse.json({ ok: false }, { status: 401 });
    }
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
  const firstName = message.from?.first_name || '';
  const lastName = message.from?.last_name || '';
  const fromName = [firstName, lastName].filter(Boolean).join(' ') || 'Водитель';

  if (!chatId || !text) {
    return NextResponse.json({ ok: true });
  }

  // 2. Обработка команды /start <driver_id>
  if (text.startsWith('/start')) {
    const parts = text.split(/\s+/);
    const driverId = parts[1];

    if (!driverId) {
      await sendMessage(
        chatId,
        '👋 Привет! Я бот Logistics CRM.\n\nЧтобы получать уведомления о новых рейсах, попросите ссылку у офиса.'
      );
      return NextResponse.json({ ok: true });
    }

    const supabase = await createClient();
    const { data: driver } = await supabase
      .from('drivers')
      .select('id, first_name, last_name')
      .eq('id', driverId)
      .maybeSingle();

    if (!driver) {
      await sendMessage(
        chatId,
        '❌ Ссылка недействительна. Попросите офис прислать новую.'
      );
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase
      .from('drivers')
      .update({ telegram_chat_id: chatId })
      .eq('id', driverId);

    if (error) {
      console.error('[telegram/webhook] save chat_id error:', error);
      await sendMessage(chatId, '⚠️ Ошибка сохранения. Попробуйте позже.');
      return NextResponse.json({ ok: true });
    }

    await sendMessage(
      chatId,
      `✅ Готово, ${driver.first_name || fromName}!\n\nТеперь вы будете получать уведомления о новых рейсах.`
    );
    return NextResponse.json({ ok: true });
  }

  // Другие команды игнорируем
  return NextResponse.json({ ok: true });
}

async function sendMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
      cache: 'no-store',
    });
  } catch (e) {
    console.error('[telegram/webhook] sendMessage error:', e);
  }
}
