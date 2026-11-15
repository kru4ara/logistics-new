import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/admin';
import { resolvePortal } from '../../../../../lib/portal';
import { providerById } from '../../../../../lib/invoicing';

export const dynamic = 'force-dynamic';

/** PDF фактуры для портала клиента: только заказ этого клиента. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string; tripId: string }> }) {
  const { token, tripId } = await ctx.params;
  const portal = await resolvePortal(token);
  if (!portal) return new NextResponse('Not found', { status: 404 });

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from('trips')
    .select('client_id, invoice_provider, invoice_external_id, invoice_number')
    .eq('id', tripId)
    .maybeSingle();
  const provider = providerById(trip?.invoice_provider);
  if (!trip || trip.client_id !== portal.clientId || !trip.invoice_external_id || !provider) {
    return new NextResponse('Not found', { status: 404 });
  }
  try {
    const pdf = await provider.pdf(trip.invoice_external_id as string);
    const name = `faktura-${String(trip.invoice_number ?? '').replace(/[^\w.-]+/g, '_') || 'invoice'}.pdf`;
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${name}"`,
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch {
    return new NextResponse('Bad gateway', { status: 502 });
  }
}
