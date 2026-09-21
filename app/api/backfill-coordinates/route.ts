import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase-server';

async function geocode(city: string | null, country: string | null): Promise<{ lat: number; lng: number } | null> {
  if (!city || !country) return null;
  try {
    const query = encodeURIComponent(`${city}, ${country}`);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
      { headers: { 'User-Agent': 'LogisticsCRM/1.0 (contact@raibuilding.pl)' } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error('Geocode error:', e);
  }
  return null;
}

export async function GET() {
  const supabase = await createClient();

  // Все рейсы без координат выгрузки, но с городом/страной получателя
  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, trip_number, sender_city, sender_country, receiver_city, receiver_country, start_lat, start_lng, end_lat, end_lng')
    .order('trip_number', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  let updatedStart = 0;
  let updatedEnd = 0;
  let skipped = 0;
  const failed: Array<{ id: string; trip_number: number | null; reason: string }> = [];

  for (const t of trips || []) {
    const update: Record<string, number> = {};

    // Старт
    if (!t.start_lat || !t.start_lng) {
      if (t.sender_city && t.sender_country) {
        const c = await geocode(t.sender_city, t.sender_country);
        if (c) {
          update.start_lat = c.lat;
          update.start_lng = c.lng;
        } else {
          failed.push({ id: t.id, trip_number: t.trip_number, reason: `sender: ${t.sender_city}, ${t.sender_country}` });
        }
      }
    }

    // Финиш
    if (!t.end_lat || !t.end_lng) {
      if (t.receiver_city && t.receiver_country) {
        const c = await geocode(t.receiver_city, t.receiver_country);
        if (c) {
          update.end_lat = c.lat;
          update.end_lng = c.lng;
        } else {
          failed.push({ id: t.id, trip_number: t.trip_number, reason: `receiver: ${t.receiver_city}, ${t.receiver_country}` });
        }
      }
    }

    if (Object.keys(update).length === 0) {
      skipped++;
      continue;
    }

    const { error: updErr } = await supabase
      .from('trips')
      .update(update)
      .eq('id', t.id);

    if (updErr) {
      failed.push({ id: t.id, trip_number: t.trip_number, reason: updErr.message });
    } else {
      if (update.start_lat) updatedStart++;
      if (update.end_lat) updatedEnd++;
    }

    // Nominatim: 1 req/sec. Между запросами минимум 1.1 сек
    await new Promise((r) => setTimeout(r, 1100));
  }

  return NextResponse.json({
    success: true,
    total: trips?.length || 0,
    updatedStart,
    updatedEnd,
    skipped,
    failedCount: failed.length,
    failed: failed.slice(0, 10),
  });
}
