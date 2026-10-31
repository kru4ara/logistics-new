import { describe, it, expect, vi } from 'vitest';
import { renumberAllTrips } from '../trip-renumber';

function createMockSupabase(mockTrips: any[]) {
  const updatesMap = new Map<string, string>();

  const mock = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [...mockTrips].sort((a, b) => {
              if (a.start_date === b.start_date) return a.id.localeCompare(b.id);
              return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
            }),
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockImplementation((payload: { trip_number: string }) => ({
        eq: vi.fn().mockImplementation((column: string, value: string) => {
          if (column === 'id') {
            updatesMap.set(value, payload.trip_number);
          }
          return Promise.resolve({ error: null });
        }),
      })),
    }),
  };

  return {
    supabase: mock as any,
    getUpdates: () =>
      Array.from(updatesMap.entries()).map(([id, trip_number]) => ({ id, trip_number })),
  };
}

describe('renumberAllTrips', () => {
  it('ничего не делает, если массив пуст', async () => {
    const { supabase, getUpdates } = createMockSupabase([]);
    await renumberAllTrips(supabase);
    expect(getUpdates().length).toBe(0);
  });

  it('ничего не делает, если номера уже идут по порядку (1, 2, 3)', async () => {
    const trips = [
      { id: 't1', trip_number: '1', start_date: '2026-01-01', end_date: '2026-01-01', profit_mode: 'trip' },
      { id: 't2', trip_number: '2', start_date: '2026-01-02', end_date: '2026-01-02', profit_mode: 'trip' },
      { id: 't3', trip_number: '3', start_date: '2026-01-03', end_date: '2026-01-03', profit_mode: 'trip' },
    ];
    const { supabase, getUpdates } = createMockSupabase(trips);
    await renumberAllTrips(supabase);
    expect(getUpdates().length).toBe(0);
  });

  it('перенумеровывает, если есть дырки (1, 3, 5 → 1, 2, 3)', async () => {
    const trips = [
      { id: 't1', trip_number: '1', start_date: '2026-01-01', end_date: '2026-01-01', profit_mode: 'trip' },
      { id: 't2', trip_number: '3', start_date: '2026-01-02', end_date: '2026-01-02', profit_mode: 'trip' },
      { id: 't3', trip_number: '5', start_date: '2026-01-03', end_date: '2026-01-03', profit_mode: 'trip' },
    ];
    const { supabase, getUpdates } = createMockSupabase(trips);
    await renumberAllTrips(supabase);

    const finalUpdates = getUpdates();
    expect(finalUpdates).toHaveLength(2);
    expect(finalUpdates.find((u) => u.id === 't2')?.trip_number).toBe('2');
    expect(finalUpdates.find((u) => u.id === 't3')?.trip_number).toBe('3');
  });

  it('перенумеровывает, если номера перепутаны (1, 2, 3 → 3, 1, 2 по дате)', async () => {
    const trips = [
      { id: 't1', trip_number: '1', start_date: '2026-01-03', end_date: '2026-01-03', profit_mode: 'trip' },
      { id: 't2', trip_number: '2', start_date: '2026-01-01', end_date: '2026-01-01', profit_mode: 'trip' },
      { id: 't3', trip_number: '3', start_date: '2026-01-02', end_date: '2026-01-02', profit_mode: 'trip' },
    ];
    const { supabase, getUpdates } = createMockSupabase(trips);
    await renumberAllTrips(supabase);

    const finalUpdates = getUpdates();
    expect(finalUpdates).toHaveLength(3);
    expect(finalUpdates.find((u) => u.id === 't2')?.trip_number).toBe('1');
    expect(finalUpdates.find((u) => u.id === 't3')?.trip_number).toBe('2');
    expect(finalUpdates.find((u) => u.id === 't1')?.trip_number).toBe('3');
  });

  it('ведёт две независимые ветки нумерации с суффиксом Е', async () => {
    const trips = [
      { id: 't1', trip_number: '1', start_date: '2026-01-01', end_date: '2026-01-01', profit_mode: 'trip' },
      { id: 'f1', trip_number: '1Е', load_date: '2026-01-02', unload_date: '2026-01-02', profit_mode: 'forwarding' },
      { id: 't2', trip_number: '2', start_date: '2026-01-03', end_date: '2026-01-03', profit_mode: 'trip' },
      { id: 'f2', trip_number: '2Е', load_date: '2026-01-04', unload_date: '2026-01-04', profit_mode: 'forwarding' },
    ];
    const { supabase, getUpdates } = createMockSupabase(trips);
    await renumberAllTrips(supabase);

    expect(getUpdates().length).toBe(0);
  });

  it('переводит экспедицию в ветку Е при смене режима', async () => {
    const trips = [
      { id: 't1', trip_number: '1', start_date: '2026-01-01', end_date: '2026-01-01', profit_mode: 'trip' },
      { id: 'f1', trip_number: '2', load_date: '2026-01-02', unload_date: '2026-01-02', profit_mode: 'forwarding' },
    ];
    const { supabase, getUpdates } = createMockSupabase(trips);
    await renumberAllTrips(supabase);

    const finalUpdates = getUpdates();
    expect(finalUpdates.find((u) => u.id === 't1')?.trip_number).toBe('1');
    expect(finalUpdates.find((u) => u.id === 'f1')?.trip_number).toBe('1Е');
  });

  it('заказ без даты выгрузки уходит в конец ветки', async () => {
    // Номера перепутаны: заказ в пути стоит первым, хотя должен быть последним.
    const trips = [
      // Номера перепутаны: заказ в пути (t2) стоит первым, хотя должен быть последним.
      { id: 't1', trip_number: '2', start_date: '2026-01-01', end_date: '2026-01-05', profit_mode: 'trip' },
      { id: 't2', trip_number: '1', start_date: '2026-01-02', profit_mode: 'trip' },
    ];
    const { supabase, getUpdates } = createMockSupabase(trips);
    await renumberAllTrips(supabase);

    const finalUpdates = getUpdates();
    // t1 с датой выгрузки -> 1, t2 в пути -> 2 (последний номер).
    expect(finalUpdates.find((u) => u.id === 't1')?.trip_number).toBe('1');
    expect(finalUpdates.find((u) => u.id === 't2')?.trip_number).toBe('2');
  });

  it('заказ в пути получает наибольший номер в ветке', async () => {
    const trips = [
      { id: 'a', trip_number: '2', start_date: '2026-01-01', end_date: '2026-01-02', profit_mode: 'trip' },
      { id: 'b', trip_number: '3', start_date: '2026-01-03', end_date: '2026-01-04', profit_mode: 'trip' },
      { id: 'c', trip_number: '1', start_date: '2026-01-05', profit_mode: 'trip' },
    ];
    const { supabase, getUpdates } = createMockSupabase(trips);
    await renumberAllTrips(supabase);

    const finalUpdates = getUpdates();
    expect(finalUpdates.find((u) => u.id === 'c')?.trip_number).toBe('3');
  });
});
