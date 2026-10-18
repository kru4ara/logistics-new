/**
 * Единая функция геокодирования через Nominatim.
 * Ограничивает поиск Европой (+ Турция, Марокко, Египет), чтобы не находить
 * одноимённые города в США/Азии.
 */

// Бbox Европы + MENA: lon от -25 до 60, lat от 20 до 72
// (W,S,E,N) — так order в Nominatim: west,south,east,north
const VIEWBOX = '-25,20,60,72';

export async function geocode(
  city: string | null,
  country: string | null
): Promise<{ lat: number; lng: number } | null> {
  if (!city || !country) return null;

  try {
    const q = encodeURIComponent(`${city}, ${country}`);
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${q}` +
      `&format=json` +
      `&limit=1` +
      `&viewbox=${VIEWBOX}` +
      `&bounded=1`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'LogisticsCRM/1.0 (contact@raibuilding.pl)' },
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
    return null;
  } catch (e) {
    console.error('[geocode] error:', e);
    return null;
  }
}
