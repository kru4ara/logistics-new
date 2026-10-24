import { describe, it, expect, vi } from 'vitest';
import { renumberAllTrips } from '../trip-renumber';

function createMockSupabase(mockTrips: any[]) {
  const updatesMap = new Map<string, number>();

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
      update: vi.fn().mockImplementation((payload: { trip_number: number }) => ({
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
    getUpdates: () => Array.from(updatesMap.entries()).map(([id, trip_number]) => ({ id, trip_number })),
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

    const finalUpdates = getUpdates();
    expect(finalUpdates).toHaveLength(2);
    expect(finalUpdates.find((u) => u.id === 't2')?.trip_number).toBe(2);
    expect(finalUpdates.find((u) => u.id === 't3')?.trip_number).toBe(3);
  });

  it('перенумеровывает, если номера перепутаны (1, 2, 3 → 3, 1, 2 по дате)', async () => {
    const trips = [
      { id: 't1', trip_number: 1, start_date: '2026-01-03' },
      { id: 't2', trip_number: 2, start_date: '2026-01-01' },
      { id: 't3', trip_number: 3, start_date: '2026-01-02' },
    ];
    const { supabase, getUpdates } = createMockSupabase(trips);
    await renumberAllTrips(supabase);

    const finalUpdates = getUpdates();
    expect(finalUpdates).toHaveLength(3);
    expect(finalUpdates.find((u) => u.id === 't2')?.trip_number).toBe(1);
    expect(finalUpdates.find((u) => u.id === 't3')?.trip_number).toBe(2);
    expect(finalUpdates.find((u) => u.id === 't1')?.trip_number).toBe(3);
  });
});
