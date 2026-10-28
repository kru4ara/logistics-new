// ============================================================
// Базовый словарь для перевода данных заявки на польский
// ============================================================

const DICTIONARY: Record<string, string> = {
  // Типы грузов
  'палеты': 'palety',
  'паллеты': 'palety',
  'палета': 'paleta',
  'паллета': 'paleta',
  'коробки': 'kartony',
  'коробка': 'karton',
  'мешки': 'worki',
  'мешок': 'worek',
  'биг бэг': 'big bag',
  'биг-бэг': 'big bag',
  'рулоны': 'rolki',
  'рулон': 'rolka',
  'бочки': 'beczki',
  'бочка': 'beczka',
  'контейнер': 'kontener',
  'контейнеры': 'kontenery',
  'металл': 'metal',
  'оборудование': 'sprzęt',
  'мебель': 'meble',
  'продукты': 'żywność',
  'еда': 'żywność',
  'напитки': 'napoje',
  'химия': 'chemikalia',
  'стройматериалы': 'materiały budowlane',
  'запчасти': 'części zamienne',
  'одежда': 'odzież',
  'обувь': 'obuwie',
  'игрушки': 'zabawki',
  'бумага': 'papier',
  'картон': 'karton',
  'пластик': 'plastik',
  'стекло': 'szkło',
  'дерево': 'drewno',
  'шоколад': 'czekolada',
  'конфеты': 'cukierki',
  'сладости': 'słodycze',
  'кофе': 'kawa',
  'чай': 'herbata',
  'вода': 'woda',
  'сок': 'sok',
  'пиво': 'piwo',
  'вино': 'wino',
  'мясо': 'mięso',
  'рыба': 'ryby',
  'овощи': 'warzywa',
  'фрукты': 'owoce',
  'молоко': 'mleko',
  'сыр': 'ser',
  'хлеб': 'chleb',
  
  // Дополнительные слова
  'груз': 'ładunek',
  'товар': 'towar',
  'запчасть': 'część',
  'стандарт': 'standard',
  'мега': 'mega',
  'реф': 'chłodnia',
  'холодильник': 'chłodnia',
};

/**
 * Переводит строку на польский, используя словарь.
 * Если точного совпадения нет, переводит по словам.
 */
export function translateToPl(text: string | null | undefined): string {
  if (!text) return '';
  
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  
  // 1. Прямое совпадение
  if (DICTIONARY[lower]) {
    return DICTIONARY[lower];
  }
  
  // 2. Попробовать перевести по словам (если текст длинный)
  const words = trimmed.split(/(\s+|,|-)/);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordLower = word.toLowerCase();
    if (DICTIONARY[wordLower]) {
      // Сохраняем первую букву заглавной, если она была
      const isCapitalized = word[0] === word[0].toUpperCase();
      const translated = DICTIONARY[wordLower];
      words[i] = isCapitalized 
        ? translated.charAt(0).toUpperCase() + translated.slice(1) 
        : translated;
    }
  }
  
  return words.join('');
}
