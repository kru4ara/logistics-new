import { NextResponse, type NextRequest } from 'next/server';
import { runInvoiceSync } from '../../../../lib/invoicing/sync';
import { sendCronAlert } from '../../../../lib/cron-alert';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Сверка дебиторки с сервисом фактур (оплаты, сроки, номера KSeF). Vercel Cron. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: 'CRON_SECRET is not configured' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const report = await runInvoiceSync();
  if (!report.ok && report.reason === 'error') {
    await sendCronAlert('invoices-sync', report.message ?? 'error').catch(() => {});
    return NextResponse.json(report, { status: 502 });
  }
  return NextResponse.json(report);
}
