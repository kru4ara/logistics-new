import { describe, it, expect } from 'vitest';
import {
  classifyCapex,
  normalizeCategory,
  capexRuleLabel,
  CAPEX_MIN_AMOUNT_EUR,
} from '../capex';

describe('автоопределение инвестиций (CAPEX)', () => {
  it('покупка имущества от порога - инвестиция', () => {
    expect(classifyCapex('Покупка Scania', 11580).isCapex).toBe(true);
    expect(classifyCapex('Покупка Прицепа Wielton', 7903.06).isCapex).toBe(true);
    expect(classifyCapex('Приобретение прицепа', 5000).isCapex).toBe(true);
    expect(classifyCapex('Покупка Scania', 11580).rule).toBe('asset');
    expect(classifyCapex('Приобретение лицензии', 5000).rule).toBe('purchase');
    // "оборудование" - имущество, поэтому rule = asset, даже при слове "приобретение"
    expect(classifyCapex('Приобретение оборудования', 5000).rule).toBe('asset');
  });

  it('операционные расходы - не инвестиции', () => {
    expect(classifyCapex('Flag', 1000).isCapex).toBe(false);
    expect(classifyCapex('ZUS', 895.45).isCapex).toBe(false);
    expect(classifyCapex('Оформление Скании', 73.73).isCapex).toBe(false);
    expect(classifyCapex('Заправка Скании', 101.33).isCapex).toBe(false);
    expect(classifyCapex('Страховка РБ на 3 мес ДАФ', 282.79).isCapex).toBe(false);
  });

  it('то же слово, но ниже порога - расход', () => {
    expect(classifyCapex('Покупка Scania', CAPEX_MIN_AMOUNT_EUR - 0.01).isCapex).toBe(false);
    expect(classifyCapex('Покупка Scania', 999).rule).toBe('below_threshold');
  });

  it('пустая категория или нулевая сумма - не инвестиция', () => {
    expect(classifyCapex('', 5000).isCapex).toBe(false);
    expect(classifyCapex(null, 5000).isCapex).toBe(false);
    expect(classifyCapex(undefined, 5000).isCapex).toBe(false);
    expect(classifyCapex('Покупка Scania', 0).isCapex).toBe(false);
    expect(classifyCapex('Покупка Scania', null).isCapex).toBe(false);
  });

  it('основы слов в падежах распознаются', () => {
    expect(classifyCapex('Прицеп Wielton', 7903).isCapex).toBe(true);
    expect(classifyCapex('Тягач', 40000).isCapex).toBe(true);
  });

  it('нормализация категории', () => {
    expect(normalizeCategory('  Покупка  Scania ')).toBe('покупка scania');
    expect(normalizeCategory('Ёлка')).toBe('елка');
    expect(normalizeCategory(null)).toBe('');
  });

  it('подпись правила', () => {
    expect(capexRuleLabel('asset')).toBe('имущество');
    expect(capexRuleLabel('none')).toBe('операционный расход');
  });
});
