import { NextResponse, type NextRequest } from 'next/server';
import { runKsefPurchaseSync } from '../../../../lib/payables/sync';
import { sendCronAlert } from '../../../../lib/cron-alert';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Входящие фактуры подрядчиков из KSeF — ночью (KSeF советует ночное окно для малых объёмов). */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: 'CRON_SECRET is not configured' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const report = await runKsefPurchaseSync();
  if (!report.ok && report.reason === 'error') {
    await sendCronAlert('ksef-purchases', report.message ?? 'error').catch(() => {});
    return NextResponse.json(report, { status: 502 });
  }
  return NextResponse.json(report);
}
