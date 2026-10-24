import { describe, it, expect, vi } from 'vitest';
import { renumberAllTrips } from '../trip-renumber';

// Фабрика для создания фейкового Supabase клиента
function createMockSupabase(mockTrips: any[]) {
  const updates: { id: string; trip_number: number }[] = [];

  const mock = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockTrips, error: null }),
        }),
      }),
      update: vi.fn().mockImplementation((payload: { trip_number: number }) => ({
        eq: vi.fn().mockImplementation((column: string, value: string) => {
          if (column === 'id') {
            updates.push({ id: value, trip_number: payload.trip_number });
          }
          return Promise.resolve({ error: null });
        }),
      })),
    }),
  };

  return {
    supabase: mock as any,
    getUpdates: () => updates,
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
      { id: 't1', trip_number: 1, start_date: '2026-01-01' },
      { id: 't2', trip_number: 2, start_date: '2026-01-02' },
      { id: 't3', trip_number: 3, start_date: '2026-01-03' },
    ];
    const { supabase, getUpdates } = createMockSupabase(trips);
    await renumberAllTrips(supabase);
    expect(getUpdates().length).toBe(0);
  });

  it('перенумеровывает, если есть дырки (1, 3, 5 → 1, 2, 3)', async () => {
    const trips = [
      { id: 't1', trip_number: 1, start_date: '2026-01-01' },
      { id: 't2', trip_number: 3, start_date: '2026-01-02' },
      { id: 't3', trip_number: 5, start_date: '2026-01-03' },
    ];
    const { supabase, getUpdates } = createMockSupabase(trips);
    await renumberAllTrips(supabase);

    const updates = getUpdates();
    // Ожидаем, что t2 и t3 будут обновлены дважды (фаза 1: отрицательные, фаза 2: положительные)
    // Считаем только финальные положительные обновления
    const finalUpdates = updates.filter((u) => u.trip_number > 0);
    
    expect(finalUpdates).toHaveLength(2);
    expect(finalUpdates.find((u) => u.id === 't2')?.trip_number).toBe(2);
    expect(finalUpdates.find((u) => u.id === 't3')?.trip_number).toBe(3);
  });

  it('перенумеровывает, если номера перепутаны (3, 1, 2 → 1, 2, 3 по дате)', async () => {
    // Сортируем по start_date: t2 (01-01), t3 (01-02), t1 (01-03)
    const trips = [
      { id: 't1', trip_number: 3, start_date: '2026-01-03' },
      { id: 't2', trip_number: 1, start_date: '2026-01-01' },
      { id: 't3', trip_number: 2, start_date: '2026-01-02' },
    ];
    const { supabase, getUpdates } = createMockSupabase(trips);
    await renumberAllTrips(supabase);

    const updates = getUpdates().filter((u) => u.trip_number > 0);
    
    expect(updates).toHaveLength(3);
    expect(updates.find((u) => u.id === 't2')?.trip_number).toBe(1);
    expect(updates.find((u) => u.id === 't3')?.trip_number).toBe(2);
    expect(updates.find((u) => u.id === 't1')?.trip_number).toBe(3);
  });
});
