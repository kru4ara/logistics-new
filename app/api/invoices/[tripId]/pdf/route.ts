import { NextResponse } from 'next/server';
import { getSessionContext } from '../../../../../lib/session';
import { can } from '../../../../../lib/roles';
import { createClient } from '../../../../../lib/supabase/admin';
import { providerById } from '../../../../../lib/invoicing';

export const dynamic = 'force-dynamic';

/** PDF фактуры из сервиса фактур: ключ API остаётся на сервере. */
export async function GET(_req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { role } = await getSessionContext();
  if (!can(role, 'receivables.view')) return new NextResponse('Forbidden', { status: 403 });
  const { tripId } = await ctx.params;

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from('trips')
    .select('invoice_provider, invoice_external_id, invoice_number')
    .eq('id', tripId)
    .maybeSingle();
  const provider = providerById(trip?.invoice_provider);
  if (!trip?.invoice_external_id || !provider) return new NextResponse('Not found', { status: 404 });

  try {
    const pdf = await provider.pdf(trip.invoice_external_id as string);
    const name = `faktura-${String(trip.invoice_number ?? trip.invoice_external_id).replace(/[^\w.-]+/g, '_')}.pdf`;
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
