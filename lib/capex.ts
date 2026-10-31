/**
 * Автоопределение инвестиций (CAPEX) по общим расходам.
 *
 * Раньше признак инвестиции ставился вручную флагом is_capex, но
 * в форме общего расхода такого поля не было - флаг оставался
 * default false, и инвестиции попадали в прибыль как расходы.
 *
 * Теперь признак выводится из категории и суммы:
 *   - в категории есть признак актива или покупки
 *     ("Покупка Scania", "Приобретение прицепа", ...);
 *   - сумма не меньше CAPEX_MIN_AMOUNT_EUR.
 *
 * Мелкие операционные траты с теми же словами
 * ("Оформление Скании", "Заправка Скании") остаются расходами.
 *
 * Правило лежит в одном месте и покрыто тестами, поэтому ручная
 * разметка не нужна: переоценка категории переоценивает и признак.
 */

export const CAPEX_MIN_AMOUNT_EUR = 1000;

/**
 * Основы слов про имущество: трак, прицеп, техника, оборудование...
 * Основы, а не слова целиком: нужны падежи ("Прицепа", "Трак").
 */
const ASSET_STEMS = [
  'scania',
  'прицеп',
  'тягач',
  'трактор',
  'автомобил',
  'фургон',
  'кран',
  'погрузчик',
  'техник',
  'оборудован',
  'компьютер',
  'ноутбук',
  'сервер',
  'станок',
  'контейнер',
  'цистерн',
  'wielton',
];

/**
 * Основы слов о приобретении: покупка, приобретение, инвестиция...
 */
const PURCHASE_STEMS = [
  'покупк',
  'приобрет',
  'инвестиц',
  'inwestycj',
  'zakup',
];

export type CapexRule = 'asset' | 'purchase' | 'below_threshold' | 'none';

export type CapexClassification = {
  isCapex: boolean;
  rule: CapexRule;
};

/**
 * Приводит категорию к сравнимому виду: нижний регистр, "ё" -> "е",
 * без знаков препинания, без лишних пробелов.
 */
export function normalizeCategory(value: string | null | undefined): string {
  return (value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ищет основу слова в тексте по границам слов.
 * "прицеп" находит "Прицепа", но не "спикер".
 */
function containsStem(text: string, stem: string): boolean {
  const re = new RegExp('(^|[^a-zа-я0-9])' + stem, 'i');
  return re.test(text);
}

/**
 * Определяет, является ли общий расход инвестицией.
 *
 * @param category  категория расхода
 * @param amountEur сумма в евро
 */
export function classifyCapex(
  category: string | null | undefined,
  amountEur: number | null | undefined
): CapexClassification {
  const amount = Number(amountEur ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { isCapex: false, rule: 'none' };
  }

  const text = normalizeCategory(category);
  if (!text) return { isCapex: false, rule: 'none' };

  const isAsset = ASSET_STEMS.some((k) => containsStem(text, k));
  const isPurchase = PURCHASE_STEMS.some((k) => containsStem(text, k));

  if (!isAsset && !isPurchase) {
    return { isCapex: false, rule: 'none' };
  }
  if (amount < CAPEX_MIN_AMOUNT_EUR) {
    return { isCapex: false, rule: 'below_threshold' };
  }
  return { isCapex: true, rule: isAsset ? 'asset' : 'purchase' };
}

/** Человекочитаемое описание правила - для подписи в интерфейсе. */
export function capexRuleLabel(rule: CapexRule): string {
  switch (rule) {
    case 'asset':
      return 'имущество';
    case 'purchase':
      return 'приобретение';
    case 'below_threshold':
      return 'сумма ниже порога - расход';
    default:
      return 'операционный расход';
  }
}
