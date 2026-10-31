import { describe, it, expect } from 'vitest';
import { calculateProfitability, getOrderPeriodDate } from '../profitability';

describe('calculateProfitability', () => {
  it('возвращает пустые массивы, если данных нет', () => {
    const result = calculateProfitability({
      orders: [],
      expensesByOrder: {},
      contractorByOrder: {},
    });

    expect(result.clientRows).toHaveLength(0);
    expect(result.truckRows).toHaveLength(0);
    expect(result.totalRevenue).toBe(0);
    expect(result.totalProfit).toBe(0);
  });

  it('агрегирует заказы-рейсы по клиентам', () => {
    const orders = [
      {
        id: 't1',
        profit_mode: 'trip',
        client_id: 'c1',
        truck_id: 'tr1',
        revenue_eur: 1000,
        actual_km: 500,
        clients: { name: 'Клиент А' },
        trucks: { registration_number: 'А123' },
      },
      {
        id: 't2',
        profit_mode: 'trip',
        client_id: 'c1',
        truck_id: 'tr1',
        revenue_eur: 2000,
        actual_km: 700,
        clients: { name: 'Клиент А' },
        trucks: { registration_number: 'А123' },
      },
      {
        id: 't3',
        profit_mode: 'trip',
        client_id: 'c2',
        truck_id: 'tr2',
        revenue_eur: 1500,
        actual_km: 300,
        clients: { name: 'Клиент Б' },
        trucks: { registration_number: 'Б456' },
      },
    ];
    const expensesByOrder = { t1: 200, t2: 400, t3: 300 };

    const result = calculateProfitability({
      orders,
      expensesByOrder,
      contractorByOrder: {},
    });

    expect(result.clientRows).toHaveLength(2);

    const clientA = result.clientRows.find((r) => r.name === 'Клиент А' && r.type === 'Заказы')!;
    expect(clientA.count).toBe(2);
    expect(clientA.revenue).toBe(3000);
    expect(clientA.expenses).toBe(600);
    expect(clientA.profit).toBe(2400);
    expect(clientA.margin).toBe(80);

    const clientB = result.clientRows.find((r) => r.name === 'Клиент Б' && r.type === 'Заказы')!;
    expect(clientB.count).toBe(1);
    expect(clientB.revenue).toBe(1500);
    expect(clientB.expenses).toBe(300);
    expect(clientB.profit).toBe(1200);
    expect(clientB.margin).toBe(80);

    expect(result.truckRows).toHaveLength(2);
    const truck1 = result.truckRows.find((r) => r.registration === 'А123')!;
    expect(truck1.count).toBe(2);
    expect(truck1.km).toBe(1200);
    expect(truck1.revenue).toBe(3000);
    expect(truck1.expenses).toBe(600);
    expect(truck1.profit).toBe(2400);

    expect(result.totalRevenue).toBe(4500);
    expect(result.totalExpenses).toBe(900);
    expect(result.totalProfit).toBe(3600);
  });

  it('отделяет экспедирование в отдельную строку по тому же клиенту', () => {
    const orders = [
      {
        id: 't1',
        profit_mode: 'trip',
        client_id: 'c1',
        revenue_eur: 1000,
        clients: { name: 'Клиент А' },
      },
      {
        id: 'f1',
        profit_mode: 'forwarding',
        client_id: 'c1',
        revenue_eur: 4000,
        clients: { name: 'Клиент А' },
      },
    ];

    const result = calculateProfitability({
      orders,
      expensesByOrder: { f1: 200 },
      contractorByOrder: { f1: 3000 },
    });

    const tripRow = result.clientRows.find((r) => r.name === 'Клиент А' && r.type === 'Заказы')!;
    const fwdRow = result.clientRows.find((r) => r.name === 'Клиент А' && r.type === 'Экспедирование')!;

    expect(tripRow.count).toBe(1);
    expect(tripRow.revenue).toBe(1000);
    expect(tripRow.expenses).toBe(0);
    expect(tripRow.profit).toBe(1000);

    expect(fwdRow.count).toBe(1);
    expect(fwdRow.revenue).toBe(4000);
    expect(fwdRow.expenses).toBe(3200);
    expect(fwdRow.profit).toBe(800);

    expect(result.totalRevenue).toBe(5000);
    expect(result.totalExpenses).toBe(3200);
    expect(result.totalProfit).toBe(1800);
  });

  it('не тянет экспедирование в строки по нашему транспорту', () => {
    const orders = [
      {
        id: 't1',
        profit_mode: 'trip',
        truck_id: 'tr1',
        revenue_eur: 1000,
        actual_km: 500,
        clients: { name: 'Клиент А' },
        trucks: { registration_number: 'А123' },
      },
      {
        id: 'f1',
        profit_mode: 'forwarding',
        truck_id: 'tr1',
        revenue_eur: 4000,
        clients: { name: 'Клиент А' },
        trucks: { registration_number: 'А123' },
      },
    ];

    const result = calculateProfitability({
      orders,
      expensesByOrder: {},
      contractorByOrder: {},
    });

    expect(result.truckRows).toHaveLength(1);
    expect(result.truckRows[0].count).toBe(1);
    expect(result.truckRows[0].revenue).toBe(1000);
  });
});

describe('getOrderPeriodDate', () => {
  it('берёт дату финиша для рейса, загрузки для экспедирования', () => {
    expect(
      getOrderPeriodDate({
        profit_mode: 'trip',
        start_date: '2026-03-01',
        end_date: '2026-05-05',
      })
    ).toBe('2026-05-05');

    expect(
      getOrderPeriodDate({
        profit_mode: 'forwarding',
        load_date: '2026-04-10',
        unload_date: '2026-05-20',
      })
    ).toBe('2026-04-10');
  });

  it('возвращает null, если дат нет', () => {
    expect(getOrderPeriodDate({ profit_mode: 'trip' })).toBeNull();
    expect(getOrderPeriodDate(null)).toBeNull();
  });
});
