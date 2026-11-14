import { NextResponse } from 'next/server';
import { getSessionContext } from '../../../lib/session';
import { reportClientError } from '../../../lib/error-alerts';

export const dynamic = 'force-dynamic';

/**
 * Ошибка в браузере → Telegram владельца (lib/error-alerts.ts).
 * Только для вошедших пользователей (proxy.ts отвечает 401 остальным); тело обрезается,
 * одинаковые ошибки — не чаще раза в 30 минут.
 */
export async function POST(request: Request) {
  const { role } = await getSessionContext();
  if (!role) return new NextResponse(null, { status: 401 });

  let body: { message?: unknown; path?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const path = typeof body.path === 'string' ? body.path : '/';
  if (!message) return new NextResponse(null, { status: 400 });

  await reportClientError({ message, path, role });
  return new NextResponse(null, { status: 204 });
}
