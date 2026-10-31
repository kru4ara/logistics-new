'use server';

import { createClient } from '../../lib/supabase/admin';
import { getSessionContext } from '../../lib/session';
import { can } from '../../lib/roles';
import { FORWARDING_SUFFIX } from '../../lib/orders-core';
import { buildRouteMap, type SegmentRouteRow } from '../../lib/trip-route';

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

// Supabase возвращает связь как массив — вытаскиваем name из первого элемента
function pickName(rel: unknown): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.name;
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name;
  }
  return undefined;
}

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
  const { role } = await getSessionContext();
  if (!can(role, 'search.view')) return empty;

  const supabase = await createClient();
  const q = query;
  const like = `%${q}%`;
  const isNumeric = /^\d+$/.test(q);

  // ============================================================
  // РЕЙСЫ: trip_number (если число) + маршрут из trip_segments
  // (from_city / from_country / to_city / to_country)
  // ============================================================
  const tripsMap = new Map<string, SearchHit>();
  const tripIdsFromSegments = new Set<string>();

  // 1) Если число — прямой поиск по номеру заказа (текстовый).
  //    Номера бывают двух видов: '42' (рейс) и '42Е' (экспедирование).
  if (isNumeric) {
    const { data } = await supabase
      .from('trips')
      .select('id, trip_number, start_date, clients(name)')
      .in('trip_number', [q, q + FORWARDING_SUFFIX])
      .limit(LIMIT_PER_DOMAIN);

    for (const t of data || []) {
      tripIdsFromSegments.add(t.id);
    }
  }

  // 2) Поиск trip_id через сегменты (города/страны)
  const { data: segHits } = await supabase
    .from('trip_segments')
    .select('trip_id, position, from_city, from_country, to_city, to_country')
    .or(
      `from_city.ilike.${like},from_country.ilike.${like},to_city.ilike.${like},to_country.ilike.${like}`
    )
    .limit(200); // с запасом, потом срежем до LIMIT_PER_DOMAIN

  for (const s of segHits || []) {
    if (s.trip_id) tripIdsFromSegments.add(s.trip_id);
  }

  // 3) Тянем рейсы по всем найденным id + их сегменты для subtitle
  if (tripIdsFromSegments.size > 0) {
    const ids = Array.from(tripIdsFromSegments);

    const [{ data: tripsData }, { data: allSegments }] = await Promise.all([
      supabase
        .from('trips')
        .select('id, trip_number, start_date, clients(name)')
        .in('id', ids)
        .limit(LIMIT_PER_DOMAIN),
      supabase
        .from('trip_segments')
        .select('trip_id, position, from_city, from_country, to_city, to_country')
        .in('trip_id', ids),
    ]);

    const routeMap = buildRouteMap((allSegments || []) as SegmentRouteRow[]);

    for (const t of tripsData || []) {
      const clientName = pickName(t.clients);
      const info = routeMap.get(t.id);
      tripsMap.set(t.id, {
        domain: 'trip',
        id: t.id,
        title: `Рейс №${t.trip_number ?? '—'}${clientName ? ' · ' + clientName : ''}`,
        subtitle: info?.route ?? null,
        icon: '📋',
        href: `/trips/${t.id}`,
      });
    }
  }

  const trips = Array.from(tripsMap.values()).slice(0, LIMIT_PER_DOMAIN);

  // ============================================================
  // КЛИЕНТЫ: name + contact_person → ведут на /clients/[id]
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
    href: `/clients/${c.id}`,
  }));

  // ============================================================
  // ВОДИТЕЛИ: first_name + last_name → ведут на /drivers/[id]
  // ============================================================
  const { data: driversData } = await supabase
    .from('drivers')
    .select('id, first_name, last_name, phone_by, phone_pl')
    .or(`first_name.ilike.${like},last_name.ilike.${like}`)
    .order('last_name')
    .limit(LIMIT_PER_DOMAIN);

  const drivers: SearchHit[] = (driversData || []).map((d) => ({
    domain: 'driver',
    id: d.id,
    title: `${d.first_name} ${d.last_name}`,
    subtitle: d.phone_pl || d.phone_by || null,
    icon: '🚛',
    href: `/drivers/${d.id}`,
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
    href: `/contractors/${c.id}/edit`,
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
      const clientName = pickName(o.clients);
      fwdMap.set(o.id, {
        domain: 'forwarding',
        id: o.id,
        title: `Заявка #${o.order_number ?? '—'}${clientName ? ' · ' + clientName : ''}`,
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
    const clientName = pickName(o.clients);
    fwdMap.set(o.id, {
      domain: 'forwarding',
      id: o.id,
      title: `Заявка #${o.order_number ?? '—'}${clientName ? ' · ' + clientName : ''}`,
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
