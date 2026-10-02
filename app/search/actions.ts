'use server';

import { createClient } from '../../lib/supabase-server';
import { cookies } from 'next/headers';

export type SearchHit = {
  domain: 'trip' | 'client' | 'driver' | 'contractor' | 'forwarding';
  id: string;
  title: string;
  subtitle: string | null;
  icon: string;
  href: string;
};

export type SearchResult = {
  query: string;
  trips: SearchHit[];
  clients: SearchHit[];
  drivers: SearchHit[];
  contractors: SearchHit[];
  forwarding: SearchHit[];
  total: number;
};

const LIMIT_PER_DOMAIN = 8;

export async function globalSearch(rawQuery: string): Promise<SearchResult> {
  const query = (rawQuery ?? '').trim();

  const empty: SearchResult = {
    query,
    trips: [],
    clients: [],
    drivers: [],
    contractors: [],
    forwarding: [],
    total: 0,
  };

  if (query.length < 2) return empty;

  // Только офис
  const role = cookies().get('role')?.value;
  if (role !== 'admin') return empty;

  const supabase = await createClient();
  const q = query;
  const like = `%${q}%`;
  const isNumeric = /^\d+$/.test(q);

  // ============================================================
  // РЕЙСЫ: trip_number (если число) + route + sender_city + receiver_city
  // ============================================================
  const tripsById: SearchHit[] = [];
  if (isNumeric) {
    const { data } = await supabase
      .from('trips')
      .select('id, trip_number, route, start_date, clients(name)')
      .eq('trip_number', parseInt(q, 10))
      .limit(LIMIT_PER_DOMAIN);

    for (const t of data || []) {
      tripsById.push({
        domain: 'trip',
        id: t.id,
        title: `Рейс №${t.trip_number ?? '—'}${t.clients?.name ? ' · ' + t.clients.name : ''}`,
        subtitle: t.route || null,
        icon: '📋',
        href: `/trips/${t.id}`,
      });
    }
  }

  const [{ data: tripsByRoute }, { data: tripsByCity }] = await Promise.all([
    supabase
      .from('trips')
      .select('id, trip_number, route, start_date, clients(name)')
      .ilike('route', like)
      .order('trip_number', { ascending: false })
      .limit(LIMIT_PER_DOMAIN),
    supabase
      .from('trips')
      .select('id, trip_number, route, sender_city, receiver_city, clients(name)')
      .or(`sender_city.ilike.${like},receiver_city.ilike.${like}`)
      .order('trip_number', { ascending: false })
      .limit(LIMIT_PER_DOMAIN),
  ]);

  const tripsMap = new Map<string, SearchHit>();
  for (const h of tripsById) tripsMap.set(h.id, h);

  for (const t of [...(tripsByRoute || []), ...(tripsByCity || [])]) {
    if (tripsMap.has(t.id)) continue;
    tripsMap.set(t.id, {
      domain: 'trip',
      id: t.id,
      title: `Рейс №${t.trip_number ?? '—'}${t.clients?.name ? ' · ' + t.clients.name : ''}`,
      subtitle: t.route || null,
      icon: '📋',
      href: `/trips/${t.id}`,
    });
  }
  const trips = Array.from(tripsMap.values()).slice(0, LIMIT_PER_DOMAIN);

  // ============================================================
  // КЛИЕНТЫ: name + contact_person
  // ============================================================
  const { data: clientsData } = await supabase
    .from('clients')
    .select('id, name, contact_person, phone, email')
    .or(`name.ilike.${like},contact_person.ilike.${like}`)
    .order('name')
    .limit(LIMIT_PER_DOMAIN);

  const clients: SearchHit[] = (clientsData || []).map((c) => ({
    domain: 'client',
    id: c.id,
    title: c.name,
    subtitle: c.contact_person || c.phone || c.email || null,
    icon: '🤝',
    href: `/clients`,
  }));

  // ============================================================
  // ВОДИТЕЛИ: first_name + last_name
  // ============================================================
  const { data: driversData } = await supabase
    .from('drivers')
    .select('id, first_name, last_name, phone')
    .or(`first_name.ilike.${like},last_name.ilike.${like}`)
    .order('last_name')
    .limit(LIMIT_PER_DOMAIN);

  const drivers: SearchHit[] = (driversData || []).map((d) => ({
    domain: 'driver',
    id: d.id,
    title: `${d.first_name} ${d.last_name}`,
    subtitle: d.phone || null,
    icon: '🚛',
    href: `/drivers`,
  }));

  // ============================================================
  // ПОДРЯДЧИКИ: name + full_name + tax_id
  // ============================================================
  const { data: contractorsData } = await supabase
    .from('contractors')
    .select('id, name, full_name, country, phone, tax_id')
    .or(`name.ilike.${like},full_name.ilike.${like},tax_id.ilike.${like}`)
    .order('name')
    .limit(LIMIT_PER_DOMAIN);

  const contractors: SearchHit[] = (contractorsData || []).map((c) => ({
    domain: 'contractor',
    id: c.id,
    title: c.name,
    subtitle: [c.full_name, c.country, c.phone].filter(Boolean).join(' · ') || null,
    icon: '🏢',
    href: `/contractors`,
  }));

  // ============================================================
  // ЭКСПЕДИРОВАНИЕ: order_number (если число) + client_request_number
  // ============================================================
  const fwdMap = new Map<string, SearchHit>();

  if (isNumeric) {
    const { data } = await supabase
      .from('forwarding_orders')
      .select('id, order_number, client_request_number, load_date, clients(name)')
      .eq('order_number', parseInt(q, 10))
      .limit(LIMIT_PER_DOMAIN);

    for (const o of data || []) {
      fwdMap.set(o.id, {
        domain: 'forwarding',
        id: o.id,
        title: `Заявка #${o.order_number ?? '—'}${o.clients?.name ? ' · ' + o.clients.name : ''}`,
        subtitle: o.load_date ? new Date(o.load_date).toLocaleDateString('ru-RU') : null,
        icon: '📦',
        href: `/forwarding/${o.id}`,
      });
    }
  }

  const { data: fwdByReq } = await supabase
    .from('forwarding_orders')
    .select('id, order_number, client_request_number, load_date, clients(name)')
    .ilike('client_request_number', like)
    .order('order_number', { ascending: false })
    .limit(LIMIT_PER_DOMAIN);

  for (const o of fwdByReq || []) {
    if (fwdMap.has(o.id)) continue;
    fwdMap.set(o.id, {
      domain: 'forwarding',
      id: o.id,
      title: `Заявка #${o.order_number ?? '—'}${o.clients?.name ? ' · ' + o.clients.name : ''}`,
      subtitle: o.client_request_number
        ? `Заявка клиента № ${o.client_request_number}`
        : o.load_date
          ? new Date(o.load_date).toLocaleDateString('ru-RU')
          : null,
      icon: '📦',
      href: `/forwarding/${o.id}`,
    });
  }
  const forwarding = Array.from(fwdMap.values()).slice(0, LIMIT_PER_DOMAIN);

  const total =
    trips.length + clients.length + drivers.length + contractors.length + forwarding.length;

  return { query, trips, clients, drivers, contractors, forwarding, total };
}
