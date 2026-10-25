import { describe, it, expect } from 'vitest';
import { calculateProfitability } from '../profitability';

describe('calculateProfitability', () => {
  it('возвращает пустые массивы, если данных нет', () => {
    const result = calculateProfitability({
      trips: [],
      forwarding: [],
      expensesByTrip: {},
      contractorsByFwd: {},
      expensesByFwd: {},
    });

    expect(result.clientRows).toHaveLength(0);
    expect(result.truckRows).toHaveLength(0);
    expect(result.totalRevenue).toBe(0);
    expect(result.totalProfit).toBe(0);
  });

  it('правильно агрегирует рейсы по клиентам', () => {
    const trips = [
      { id: 't1', client_id: 'c1', truck_id: 'tr1', revenue_eur: 1000, actual_km: 500, clients: { name: 'Клиент А' }, trucks: { registration_number: 'А123' } },
      { id: 't2', client_id: 'c1', truck_id: 'tr1', revenue_eur: 2000, actual_km: 700, clients: { name: 'Клиент А' }, trucks: { registration_number: 'А123' } },
      { id: 't3', client_id: 'c2', truck_id: 'tr2', revenue_eur: 1500, actual_km: 300, clients: { name: 'Клиент Б' }, trucks: { registration_number: 'Б456' } },
    ];
    const expensesByTrip = {
      t1: 200,
      t2: 400,
      t3: 300,
    };

    const result = calculateProfitability({
      trips,
      forwarding: [],
      expensesByTrip,
      contractorsByFwd: {},
      expensesByFwd: {},
    });

    // Клиенты
    expect(result.clientRows).toHaveLength(2);
    const clientA = result.clientRows.find(r => r.name === 'Клиент А')!;
    expect(clientA.count).toBe(2);
    expect(clientA.revenue).toBe(3000);
    expect(clientA.expenses).toBe(600);
    expect(clientA.profit).toBe(2400);
    expect(clientA.margin).toBe(80); // 2400 / 3000 * 100

    const clientB = result.clientRows.find(r => r.name === 'Клиент Б')!;
    expect(clientB.count).toBe(1);
    expect(clientB.revenue).toBe(1500);
    expect(clientB.expenses).toBe(300);
    expect(clientB.profit).toBe(1200);
    expect(clientB.margin).toBe(80);

    // Машины
    expect(result.truckRows).toHaveLength(2);
    const truck1 = result.truckRows.find(r => r.registration === 'А123')!;
    expect(truck1.count).toBe(2);
    expect(truck1.km).toBe(1200);
    expect(truck1.revenue).toBe(3000);
    expect(truck1.expenses).toBe(600);
    expect(truck1.profit).toBe(2400);

    // Итоги
    expect(result.totalRevenue).toBe(4500);
    expect(result.totalExpenses).toBe(900);
    expect(result.totalProfit).toBe(3600);
  });

  it('правильно агрегирует экспедирование по клиентам', () => {
    const forwarding = [
      { id: 'f1', client_id: 'c1', client_price_eur: 1000, clients: { name: 'Клиент А' } },
    ];
    const contractorsByFwd = { f1: 600 };
    const expensesByFwd = { f1: 100 };

    const result = calculateProfitability({
      trips: [],
      forwarding,
      expensesByTrip: {},
      contractorsByFwd,
      expensesByFwd,
    });

    const clientA = result.clientRows.find(r => r.name === 'Клиент А' && r.type === 'Экспедирование')!;
    expect(clientA).toBeDefined();
    expect(clientA.count).toBe(1);
    expect(clientA.revenue).toBe(1000);
    expect(clientA.expenses).toBe(700); // 600 + 100
    expect(clientA.profit).toBe(300);
    expect(clientA.margin).toBe(30); // 300 / 1000 * 100
  });

  it('сортирует клиентов по прибыли (по убыванию)', () => {
    const trips = [
      { id: 't1', client_id: 'c1', revenue_eur: 1000, clients: { name: 'Бедный' }, trucks: null },
      { id: 't2', client_id: 'c2', revenue_eur: 5000, clients: { name: 'Богатый' }, trucks: null },
    ];
    const expensesByTrip = { t1: 900, t2: 100 };

    const result = calculateProfitability({
      trips,
      forwarding: [],
      expensesByTrip,
      contractorsByFwd: {},
      expensesByFwd: {},
    });

    expect(result.clientRows[0].name).toBe('Богатый'); // прибыль 4900
    expect(result.clientRows[1].name).toBe('Бедный');  // прибыль 100
  });

  it('игнорирует рейсы без клиента или машины (если машины нет в select)', () => {
    const trips = [
      { id: 't1', client_id: 'c1', truck_id: null, revenue_eur: 1000, clients: { name: 'Клиент' }, trucks: null },
    ];
    const result = calculateProfitability({
      trips,
      forwarding: [],
      expensesByTrip: {},
      contractorsByFwd: {},
      expensesByFwd: {},
    });

    // Клиент есть
    expect(result.clientRows).toHaveLength(1);
    // Машины нет (truck_id null) — не должно быть в truckRows
    expect(result.truckRows).toHaveLength(0);
  });
});
