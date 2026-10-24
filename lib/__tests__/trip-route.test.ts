import { describe, it, expect } from 'vitest';
import { buildRouteMap } from '../trip-route';
import type { SegmentRouteRow } from '../trip-route';

describe('buildRouteMap', () => {
  it('возвращает пустую карту для пустого массива', () => {
    const result = buildRouteMap([]);
    expect(result.size).toBe(0);
  });

  it('строит маршрут для одного сегмента', () => {
    const segments: SegmentRouteRow[] = [
      {
        trip_id: 'trip-1',
        position: 1,
        from_city: 'Минск',
        from_country: 'Беларусь',
        to_city: 'Варшава',
        to_country: 'Польша',
      },
    ];
    const result = buildRouteMap(segments);
    expect(result.get('trip-1')?.route).toBe('Минск, Беларусь → Варшава, Польша');
  });

  it('строит маршрут для нескольких сегментов (берёт первый from и последний to)', () => {
    const segments: SegmentRouteRow[] = [
      {
        trip_id: 'trip-1',
        position: 1,
        from_city: 'Минск',
        from_country: 'Беларусь',
        to_city: 'Брест',
        to_country: 'Беларусь',
      },
      {
        trip_id: 'trip-1',
        position: 2,
        from_city: 'Брест',
        from_country: 'Беларусь',
        to_city: 'Варшава',
        to_country: 'Польша',
      },
    ];
    const result = buildRouteMap(segments);
    expect(result.get('trip-1')?.route).toBe('Минск, Беларусь → Варшава, Польша');
  });

  it('сортирует сегменты по position', () => {
    const segments: SegmentRouteRow[] = [
      {
        trip_id: 'trip-1',
        position: 2,
        from_city: 'Брест',
        from_country: 'Беларусь',
        to_city: 'Варшава',
        to_country: 'Польша',
      },
      {
        trip_id: 'trip-1',
        position: 1,
        from_city: 'Минск',
        from_country: 'Беларусь',
        to_city: 'Брест',
        to_country: 'Беларусь',
      },
    ];
    const result = buildRouteMap(segments);
    expect(result.get('trip-1')?.route).toBe('Минск, Беларусь → Варшава, Польша');
  });

  it('обрабатывает null значения', () => {
    const segments: SegmentRouteRow[] = [
      {
        trip_id: 'trip-1',
        position: 1,
        from_city: null,
        from_country: 'Беларусь',
        to_city: 'Варшава',
        to_country: null,
      },
    ];
    const result = buildRouteMap(segments);
    expect(result.get('trip-1')?.route).toBe('Беларусь → Варшава');
  });

  it('возвращает null, если нет ни from, ни to', () => {
    const segments: SegmentRouteRow[] = [
      {
        trip_id: 'trip-1',
        position: 1,
        from_city: null,
        from_country: null,
        to_city: null,
        to_country: null,
      },
    ];
    const result = buildRouteMap(segments);
    expect(result.get('trip-1')?.route).toBeNull();
  });
});
