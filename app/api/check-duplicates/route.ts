import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const q = (searchParams.get('q') || '').trim();
  const taxId = (searchParams.get('taxId') || '').trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ matches: [] });
  }

  const supabase = await createClient();
  const like = `%${q}%`;

  if (type === 'client') {
    const { data } = await supabase
      .from('clients')
      .select('id, name, contact_person, phone')
      .ilike('name', like)
      .order('name')
      .limit(5);

    return NextResponse.json({
      matches: (data || []).map((c) => ({
        id: c.id,
        name: c.name,
        info: c.contact_person || c.phone || null,
        href: `/clients/${c.id}`,
      })),
    });
  }

  if (type === 'contractor') {
    const orFilters = [`name.ilike.${like}`];
    if (taxId) orFilters.push(`tax_id.eq.${taxId}`);

    const { data } = await supabase
      .from('contractors')
      .select('id, name, full_name, country, phone, tax_id')
      .or(orFilters.join(','))
      .order('name')
      .limit(5);

    return NextResponse.json({
      matches: (data || []).map((c) => ({
        id: c.id,
        name: c.name,
        info: [c.full_name, c.country, c.phone, c.tax_id ? `NIP ${c.tax_id}` : null]
          .filter(Boolean)
          .join(' · ') || null,
        href: `/contractors/${c.id}/edit`,
      })),
    });
  }

  return NextResponse.json({ matches: [] });
}
