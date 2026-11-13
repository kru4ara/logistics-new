import { describe, it, expect } from 'vitest';
import { fetchAll, fetchAllByIds } from '../fetch-all';

type Row = { id: string; trip_id?: string };

/**
 * Фейковый билдер, повторяющий поведение postgrest-js:
 * range/order меняют состояние и возвращают this, сервер режет
 * ответ до maxRows (как max_rows в PostgREST).
 */
function fakeQuery(rows: Row[], opts: { maxRows?: number; failAt?: number } = {}) {
  const calls: Array<[number, number]> = [];
  const orders: string[] = [];
  const q = {
    calls,
    orders,
    order(column: string) {
      orders.push(column);
      return q;
    },
    range(from: number, to: number) {
      calls.push([from, to]);
      if (opts.failAt !== undefined && calls.length === opts.failAt) {
        return Promise.resolve({ data: null, error: { message: 'boom' } });
      }
      const limit = Math.min(to - from + 1, opts.maxRows ?? 1000);
      return Promise.resolve({ data: rows.slice(from, from + limit), error: null });
    },
  };
  return q;
}

const make = (n: number, prefix = 'r'): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }));

describe('fetchAll', () => {
  it('отдаёт всё, когда строк больше лимита сервера (2500 > 1000)', async () => {
    const q = fakeQuery(make(2500));
    const res = await fetchAll(q);
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(2500);
    expect(new Set(res.data!.map((r) => r.id)).size).toBe(2500);
    expect(q.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('один запрос, если строк меньше страницы', async () => {
    const q = fakeQuery(make(563));
    const res = await fetchAll(q);
    expect(res.data).toHaveLength(563);
    expect(q.calls).toHaveLength(1);
  });

  it('ровно pageSize строк — второй запрос возвращает пусто и цикл завершается', async () => {
    const q = fakeQuery(make(1000));
    const res = await fetchAll(q);
    expect(res.data).toHaveLength(1000);
    expect(q.calls).toHaveLength(2);
  });

  it('пустая таблица', async () => {
    const res = await fetchAll(fakeQuery([]));
    expect(res).toEqual({ data: [], error: null });
  });

  it('добавляет сортировку по id для стабильных страниц, можно отключить', async () => {
    const q1 = fakeQuery(make(3));
    await fetchAll(q1);
    expect(q1.orders).toEqual(['id']);

    const q2 = fakeQuery(make(3));
    await fetchAll(q2, { tieBreaker: null });
    expect(q2.orders).toEqual([]);
  });

  it('ошибка на любой странице — возвращаем ошибку, а не обрезанные данные', async () => {
    const res = await fetchAll(fakeQuery(make(2500), { failAt: 2 }));
    expect(res).toEqual({ data: null, error: { message: 'boom' } });
  });

  it('предохранитель maxRows', async () => {
    const res = await fetchAll(fakeQuery(make(5000)), { maxRows: 2000 });
    expect(res.data).toBeNull();
    expect(res.error?.message).toMatch(/2000/);
  });
});

describe('fetchAllByIds', () => {
  it('режет список id на пачки и склеивает результат', async () => {
    const ids = Array.from({ length: 400 }, (_, i) => `t${i}`);
    const chunks: string[][] = [];
    const res = await fetchAllByIds(ids, (chunk) => {
      chunks.push(chunk);
      return fakeQuery(chunk.map((id) => ({ id: `seg-${id}`, trip_id: id })));
    });
    expect(chunks.map((c) => c.length)).toEqual([150, 150, 100]);
    expect(res.data).toHaveLength(400);
  });

  it('пустой список — без запросов', async () => {
    let called = false;
    const res = await fetchAllByIds([], () => {
      called = true;
      return fakeQuery([]);
    });
    expect(res).toEqual({ data: [], error: null });
    expect(called).toBe(false);
  });

  it('убирает дубли и пустые id', async () => {
    const seen: string[] = [];
    await fetchAllByIds(['a', 'a', '', 'b'], (chunk) => {
      seen.push(...chunk);
      return fakeQuery([]);
    });
    expect(seen).toEqual(['a', 'b']);
  });

  it('внутри пачки тоже листает страницы (у одного заказа >1000 строк)', async () => {
    const res = await fetchAllByIds(['t1'], () => fakeQuery(make(1500)));
    expect(res.data).toHaveLength(1500);
  });
});
