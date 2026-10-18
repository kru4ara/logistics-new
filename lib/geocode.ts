/**
 * Единая функция геокодирования через Nominatim.
 *
 * Приоритет поиска:
 *   1. postal_code + country (самый точный)
 *   2. city + country
 *   3. city (без страны)
 *
 * Ограничения:
 *   - viewbox — Европа + MENA (без США/Азии)
 *   - countrycodes — страна из маппинга (если знаем)
 *   - city очищается от скобок ("Nola (NA)" → "Nola")
 */

// Бbox Европы + MENA: lon -25..60, lat 20..72 (W,S,E,N)
const VIEWBOX = '-25,20,60,72';

// Маппинг стран в ISO 2-letter для countrycodes в Nominatim
const COUNTRY_ISO: Record<string, string> = {
  // Английские
  'Italy': 'it', 'Poland': 'pl', 'Belarus': 'by', 'Germany': 'de',
  'France': 'fr', 'Netherlands': 'nl', 'Russia': 'ru', 'Lithuania': 'lt',
  'Latvia': 'lv', 'Estonia': 'ee', 'Ukraine': 'ua', 'Czechia': 'cz',
  'Czech Republic': 'cz', 'Slovakia': 'sk', 'Hungary': 'hu', 'Romania': 'ro',
  'Bulgaria': 'bg', 'Turkey': 'tr', 'Spain': 'es', 'Portugal': 'pt',
  'Belgium': 'be', 'Austria': 'at', 'Switzerland': 'ch', 'Denmark': 'dk',
  'Sweden': 'se', 'Norway': 'no', 'Finland': 'fi', 'Croatia': 'hr',
  'Serbia': 'rs', 'Slovenia': 'si', 'Greece': 'gr', 'Moldova': 'md',
  'Luxembourg': 'lu', 'Ireland': 'ie', 'United Kingdom': 'gb',
  'Bosnia and Herzegovina': 'ba', 'Montenegro': 'me', 'Albania': 'al',
  'North Macedonia': 'mk', 'Morocco': 'ma', 'Algeria': 'dz',
  'Tunisia': 'tn', 'Egypt': 'eg', 'Israel': 'il', 'Lebanon': 'lb',

  // Русские
  'Италия': 'it', 'Польша': 'pl', 'Беларусь': 'by', 'Германия': 'de',
  'Франция': 'fr', 'Голландия': 'nl', 'Нидерланды': 'nl', 'Россия': 'ru',
  'Литва': 'lt', 'Латвия': 'lv', 'Эстония': 'ee', 'Украина': 'ua',
  'Чехия': 'cz', 'Словакия': 'sk', 'Венгрия': 'hu', 'Румыния': 'ro',
  'Болгария': 'bg', 'Турция': 'tr', 'Испания': 'es', 'Португалия': 'pt',
  'Бельгия': 'be', 'Австрия': 'at', 'Швейцария': 'ch', 'Дания': 'dk',
  'Швеция': 'se', 'Норвегия': 'no', 'Финляндия': 'fi', 'Хорватия': 'hr',
  'Сербия': 'rs', 'Словения': 'si', 'Греция': 'gr', 'Молдова': 'md',
  'Люксембург': 'lu', 'Ирландия': 'ie', 'Великобритания': 'gb',
  'Босния и Герцеговина': 'ba', 'Черногория': 'me', 'Албания': 'al',
  'Северная Македония': 'mk', 'Марокко': 'ma', 'Алжир': 'dz',
  'Тунис': 'tn', 'Египет': 'eg', 'Израиль': 'il', 'Ливан': 'lb',
};

// Убирает из city всё в скобках: "Nola (NA)" → "Nola", "Warszawa (Mokotów)" → "Warszawa"
function cleanCity(city: string): string {
  return city.replace(/\s*\([^)]*\)/g, '').trim();
}

type GeoResult = { lat: number; lng: number } | null;

async function nominatimSearch(
  query: string,
  iso: string | undefined
): Promise<GeoResult> {
  const q = encodeURIComponent(query);
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${q}` +
    `&format=json` +
    `&limit=1` +
    `&viewbox=${VIEWBOX}` +
    `&bounded=1` +
    (iso ? `&countrycodes=${iso}` : '');

  try {
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

export async function geocode(
  city: string | null,
  country: string | null,
  postalCode?: string | null
): Promise<GeoResult> {
  if (!country) return null;
  const iso = COUNTRY_ISO[country];
  const cleanedCity = city ? cleanCity(city) : null;
  const cleanedPostal = postalCode ? postalCode.trim() : null;

  // 1. postal_code + country (самый точный)
  if (cleanedPostal) {
    const r = await nominatimSearch(`${cleanedPostal}, ${country}`, iso);
    if (r) return r;
  }

  // 2. city + country
  if (cleanedCity) {
    const r = await nominatimSearch(`${cleanedCity}, ${country}`, iso);
    if (r) return r;

    // 3. city без страны (последний шанс)
    const r2 = await nominatimSearch(cleanedCity, iso);
    if (r2) return r2;
  }

  return null;
}
