import { NextResponse } from 'next/server';
import { resetDemo } from '../../../../lib/demo/reset';
import { isDemoMode } from '../../../../lib/demo/mode';

export const maxDuration = 120;

/** Ночной сброс демо (vercel.json). CRON_SECRET проверяет proxy.ts. Не демо — 404. */
export async function GET() {
  if (!isDemoMode()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const res = await resetDemo({ force: true });
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
