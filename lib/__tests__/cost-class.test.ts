import { describe, it, expect } from 'vitest';
import { isOperatingCost, costClassOf, guessCostClass } from '../cost-class';

describe('тип общего расхода', () => {
  it('в прибыль — только операционные, не инвестиции', () => {
    expect(isOperatingCost({})).toBe(true); // пусто — операционный
    expect(isOperatingCost({ cost_class: 'operating' })).toBe(true);
    expect(isOperatingCost({ cost_class: 'dividends' })).toBe(false);
    expect(isOperatingCost({ cost_class: 'cash' })).toBe(false);
    expect(isOperatingCost({ is_capex: true })).toBe(false);
    expect(costClassOf({ cost_class: 'что-то' })).toBe('operating');
  });

  it('дивиденды узнаются по тексту записи; комиссия за обнал и Flag — операционные', () => {
    expect(guessCostClass('Дивиденты на 3х по 500')).toBe('dividends');
    expect(guessCostClass('Dywidenda Q3')).toBe('dividends');
    expect(guessCostClass('Обнал Артем')).toBe('operating');
    expect(guessCostClass('Flag')).toBe('operating');
  });
});
