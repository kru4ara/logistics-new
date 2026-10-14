export type SegmentRouteRow = {
  trip_id: string;
  position: number;
  from_city: string | null;
  from_country: string | null;
  to_city: string | null;
  to_country: string | null;
};

export type TripRouteInfo = {
  route: string | null;
  from_city: string | null;
  from_country: string | null;
  to_city: string | null;
  to_country: string | null;
};

export function buildRouteMap(segments: SegmentRouteRow[]): Map<string, TripRouteInfo> {
  const byTrip = new Map<string, SegmentRouteRow[]>();
  for (const s of segments) {
    if (!s.trip_id) continue;
    if (!byTrip.has(s.trip_id)) byTrip.set(s.trip_id, []);
    byTrip.get(s.trip_id)!.push(s);
  }

  const out = new Map<string, TripRouteInfo>();

  byTrip.forEach((list, tripId) => {
    const sorted = [...list].sort((a, b) => (a.position || 0) - (b.position || 0));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const fromCity = first?.from_city ?? null;
    const fromCountry = first?.from_country ?? null;
    const toCity = last?.to_city ?? null;
    const toCountry = last?.to_country ?? null;

    const fromStr = [fromCity, fromCountry].filter(Boolean).join(', ');
    const toStr = [toCity, toCountry].filter(Boolean).join(', ');
    const route = (fromStr || toStr) ? `${fromStr || '—'} → ${toStr || '—'}` : null;

    out.set(tripId, {
      route,
      from_city: fromCity,
      from_country: fromCountry,
      to_city: toCity,
      to_country: toCountry,
    });
  });

  return out;
}
