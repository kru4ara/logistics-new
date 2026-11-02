import { describe, it, expect } from 'vitest';
import {
  calculateFuelLevels,
  latestFuelForTruck,
  formatLiters,
  type FuelTripRow,
  type FuelExpenseRow,
} from '../fuel';

function trip(over: Partial<FuelTripRow> = {}): FuelTripRow {
  return {
    id: 't1',
    truck_id: 'truck-1',
    trip_number: '1',
    status: 'invoiced',
    start_date: '2026-10-01',
    end_date: '2026-10-03',
    start_fuel_level: 300,
    actual_liters: 100,
    ...over,
  };
}

describe('остаток топлива в баке', () => {
  it('остаток завершённого рейса: старт + заправки - расход', () => {
    const trips = [trip({ id: 'a', trip_number: '74', start_fuel_level: 315.7, actual_liters: 82.2 })];
    const r = latestFuelForTruck(trips, []);
    expect(r.liters).toBe(233.5);
    expect(r.isEstimate).toBe(false);
    expect(r.tripNumber).toBe('74');
  });

  it('заправки в рамках рейса прибавляются', () => {
    const trips = [trip({ id: 'a', trip_number: '19', start_fuel_level: 124.3, actual_liters: 95 })];
    const expenses: FuelExpenseRow[] = [{ trip_id: 'a', liters: 59 }];
    expect(latestFuelForTruck(trips, expenses).liters).toBe(88.3);
  });

  it('рейс в пути: расход неизвестен, значение помечается как оценка', () => {
    const trips = [trip({ id: 'a', trip_number: '77', status: 'active', start_fuel_level: 175, actual_liters: null })];
    const r = latestFuelForTruck(trips, []);
    expect(r.liters).toBe(175);
    expect(r.isEstimate).toBe(true);
  });

  it('берётся рейс с наибольшим номером', () => {
    const trips = [
      trip({ id: 'a', trip_number: '70', start_fuel_level: 500, actual_liters: 100 }),
      trip({ id: 'b', trip_number: '75', start_fuel_level: 300, actual_liters: 100 }),
      trip({ id: 'c', trip_number: '72', start_fuel_level: 400, actual_liters: 100 }),
    ];
    const r = latestFuelForTruck(trips, []);
    expect(r.liters).toBe(200);
    expect(r.tripNumber).toBe('75');
  });

  it('рейсы без номера игнорируются', () => {
    const trips = [trip({ id: 'a', trip_number: null, start_fuel_level: 500, actual_liters: 100 })];
    expect(latestFuelForTruck(trips, []).liters).toBeNull();
  });

  it('машина без рейсов - показателя нет', () => {
    expect(latestFuelForTruck([], []).liters).toBeNull();
  });

  it('остаток не уходит в минус', () => {
    const trips = [trip({ start_fuel_level: 50, actual_liters: 300 })];
    expect(latestFuelForTruck(trips, []).liters).toBe(0);
  });

  it('карта по всем тягачам', () => {
    const trips = [
      trip({ id: 'a', truck_id: 'truck-1', trip_number: '1', start_fuel_level: 300, actual_liters: 100 }),
      trip({ id: 'b', truck_id: 'truck-2', trip_number: '2', start_fuel_level: 500, actual_liters: 50 }),
      trip({ id: 'c', truck_id: null, trip_number: '3' }),
    ];
    const map = calculateFuelLevels(trips, []);
    expect(map.size).toBe(2);
    expect(map.get('truck-1')!.liters).toBe(200);
    expect(map.get('truck-2')!.liters).toBe(450);
  });

  it('форматирование литров', () => {
    expect(formatLiters(233.5)).toBe('233,5');
    expect(formatLiters(180)).toBe('180');
    expect(formatLiters(null)).toBe('—');
  });
});
