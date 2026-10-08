// Флаг страны через flagcdn.com — работает на всех платформах, включая Windows.
// Использование:
//   <CountryFlag country="Poland" />           // 20x15 (маленький, для inline)
//   <CountryFlag country="Poland" size="md" /> // 24x18 (обычный)

type Props = {
  country: string | null;
  size?: 'sm' | 'md';
  className?: string;
};

// Маппинг англоязычных названий стран → ISO 3166-1 alpha-2.
// Покрываем то, что реально встречается в БД.
function countryToIso(country: string | null): string | null {
  if (!country) return null;
  const c = country.toLowerCase().trim();

  // Точные совпадения (приоритет — чтобы Belarus не попал в Belgium)
  const exact: Record<string, string> = {
    'poland': 'pl',
    'polska': 'pl',
    'польша': 'pl',
    'belarus': 'by',
    'belorussia': 'by',
    'беларусь': 'by',
    'республика беларусь': 'by',
    'germany': 'de',
    'deutschland': 'de',
    'германия': 'de',
    'netherlands': 'nl',
    'holland': 'nl',
    'нидерланды': 'nl',
    'belgium': 'be',
    'бельгия': 'be',
    'france': 'fr',
    'francja': 'fr',
    'франция': 'fr',
    'italy': 'it',
    'italia': 'it',
    'италия': 'it',
    'spain': 'es',
    'españa': 'es',
    'испания': 'es',
    'bulgaria': 'bg',
    'болгария': 'bg',
    'czech republic': 'cz',
    'czechia': 'cz',
    'чехия': 'cz',
    'slovakia': 'sk',
    'словакия': 'sk',
    'ukraine': 'ua',
    'украина': 'ua',
    'russia': 'ru',
    'россия': 'ru',
    'lithuania': 'lt',
    'литва': 'lt',
    'latvia': 'lv',
    'латвия': 'lv',
    'estonia': 'ee',
    'эстония': 'ee',
    'united kingdom': 'gb',
    'uk': 'gb',
    'великобритания': 'gb',
    'austria': 'at',
    'австрия': 'at',
    'switzerland': 'ch',
    'швейцария': 'ch',
    'romania': 'ro',
    'румыния': 'ro',
    'hungary': 'hu',
    'венгрия': 'hu',
    'denmark': 'dk',
    'дания': 'dk',
    'sweden': 'se',
    'швеция': 'se',
    'norway': 'no',
    'норвегия': 'no',
    'finland': 'fi',
    'финляндия': 'fi',
  };

  if (exact[c]) return exact[c];

  // Частичные совпадения (fallback для нестандартных написаний)
  if (c.includes('pol')) return 'pl';
  if (c.includes('belg')) return 'be';       // Belgium
  if (c.includes('germ') || c.includes('deutsch')) return 'de';
  if (c.includes('neth') || c.includes('holland')) return 'nl';
  if (c.includes('fran')) return 'fr';
  if (c.includes('ital')) return 'it';
  if (c.includes('spain') || c.includes('espa')) return 'es';
  if (c.includes('bulg')) return 'bg';
  if (c.includes('czech') || c.includes('чех')) return 'cz';
  if (c.includes('slovak')) return 'sk';
  if (c.includes('ukrain') || c.includes('укр')) return 'ua';
  if (c.includes('russ') || c.includes('рос')) return 'ru';
  if (c.includes('lit')) return 'lt';
  if (c.includes('latv')) return 'lv';
  if (c.includes('est')) return 'ee';
  if (c.includes('austr')) return 'at';
  if (c.includes('switz')) return 'ch';
  if (c.includes('roman') || c.includes('рум')) return 'ro';
  if (c.includes('hungar') || c.includes('венг')) return 'hu';

  // Belarus — только точное совпадение, чтобы не спутать с Belgium
  if (c === 'belarus' || c === 'беларусь' || c.startsWith('бел')) return 'by';

  return null;
}

export default function CountryFlag({ country, size = 'sm', className = '' }: Props) {
  const iso = countryToIso(country);
  if (!iso) return null;

  const width = size === 'md' ? 24 : 20;
  const height = size === 'md' ? 18 : 15;

  return (
    <img
      src={`https://flagcdn.com/${width}x${height}/${iso}.png`}
      srcSet={`https://flagcdn.com/${width * 2}x${height * 2}/${iso}.png 2x`}
      width={width}
      height={height}
      alt={country || iso.toUpperCase()}
      title={country || iso.toUpperCase()}
      loading="lazy"
      className={`inline-block rounded-sm shadow-sm align-middle shrink-0 ${className}`}
      style={{ objectFit: 'cover' }}
    />
  );
}
