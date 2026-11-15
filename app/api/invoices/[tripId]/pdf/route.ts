import { NextResponse } from 'next/server';
import { getSessionContext } from '../../../../../lib/session';
import { can } from '../../../../../lib/roles';
import { createClient } from '../../../../../lib/supabase/admin';
import { getInvoicePdf } from '../../../../../lib/fakturownia';

export const dynamic = 'force-dynamic';

/** PDF фактуры из Fakturownia: токен API остаётся на сервере. */
export async function GET(_req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { role } = await getSessionContext();
  if (!can(role, 'receivables.view')) return new NextResponse('Forbidden', { status: 403 });
  const { tripId } = await ctx.params;

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from('trips')
    .select('fakturownia_id, invoice_number')
    .eq('id', tripId)
    .maybeSingle();
  if (!trip?.fakturownia_id) return new NextResponse('Not found', { status: 404 });

  try {
    const pdf = await getInvoicePdf(trip.fakturownia_id as number);
    const name = `faktura-${String(trip.invoice_number ?? trip.fakturownia_id).replace(/[^\w.-]+/g, '_')}.pdf`;
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${name}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[invoices] pdf', e instanceof Error ? e.message : e);
    return new NextResponse('Bad gateway', { status: 502 });
  }
}
