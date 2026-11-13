/**
 * Постраничная выборка из Supabase.
 *
 * ПРОБЛЕМА:
 *   PostgREST отдаёт не больше `max_rows` строк на запрос (в Supabase по
 *   умолчанию 1000) и НЕ сообщает об обрезке: `error` пустой, просто строк
 *   меньше. Запрос «все расходы → сложить в коде» после 1000-й строки молча
 *   даёт неверную прибыль.
 *
 *   Второй лимит — длина URL. `.in('trip_id', ids)` кладёт все id в адрес
 *   (~37 символов на UUID); на нескольких сотнях заказов запрос падает,
 *   а страница показывает пустые маршруты и нулевые расходы.
 *
 * РЕШЕНИЕ:
 *   fetchAll       — листает запрос через `.range()` до пустой страницы.
 *   fetchAllByIds  — режет список id на пачки и по каждой зовёт fetchAll.
 *
 * Файл без 'server-only' и без импорта клиентов Supabase: работает с любым
 * билдером (admin или RLS) и покрывается юнит-тестами на фейковом билдере.
 */

/** Ошибка в форме PostgREST — нам нужен только message. */
export type FetchError = { message: string };

type PageResult = { data: unknown[] | null; error: FetchError | null };

/**
 * Минимум от билдера supabase-js, нужный для листания.
 * `range` и `order` в postgrest-js меняют URL билдера и возвращают его же,
 * а каждый `await` делает новый запрос по текущему URL — поэтому один
 * билдер можно листать много раз.
 */
export interface PageableQuery {
  range(from: number, to: number): PromiseLike<PageResult>;
  order(column: string, options?: { ascending?: boolean }): unknown;
}

/** Тип строки, который вернёт билдер. */
export type RowOf<Q> = Q extends { range(from: number, to: number): PromiseLike<{ data: (infer R)[] | null }> }
  ? R
  : never;

export type FetchAllResult<R> = { data: R[]; error: null } | { data: null; error: FetchError };

export type FetchAllOptions = {
  /** Сколько строк просить за раз. Не больше max_rows сервера — иначе лишний запрос. */
  pageSize?: number;
  /**
   * Колонка-«разрубатель ничьих» для стабильного порядка между страницами.
   * Добавляется ПОСЛЕ уже заданной сортировки. `null` — не добавлять
   * (если у таблицы нет такой колонки).
   */
  tieBreaker?: string | null;
  /** Предохранитель от бесконечного цикла. */
  maxRows?: number;
};

export const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_MAX_ROWS = 200_000;

/**
 * Прочитать ВСЕ строки запроса.
 *
 * Конец — страница короче запрошенной (в том числе пустая): так не нужен
 * лишний запрос, когда строк меньше pageSize.
 */
export async function fetchAll<Q extends PageableQuery>(
  query: Q,
  options: FetchAllOptions = {}
): Promise<FetchAllResult<RowOf<Q>>> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const tieBreaker = options.tieBreaker === undefined ? 'id' : options.tieBreaker;
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;

  // Без стабильного порядка PostgreSQL вправе отдавать строки в разном
  // порядке на разных страницах — строки дублируются или теряются.
  if (tieBreaker) query.order(tieBreaker, { ascending: true });

  const rows: RowOf<Q>[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) return { data: null, error };

    const page = (data ?? []) as RowOf<Q>[];
    rows.push(...page);
    offset += page.length;

    // Короткая страница — последняя. Это верно, пока max_rows сервера
    // не меньше pageSize (у Supabase по умолчанию 1000 = DEFAULT_PAGE_SIZE).
    // Если max_rows в настройках проекта уменьшат — уменьшить и pageSize.
    if (page.length < pageSize) break;
    if (rows.length >= maxRows) {
      return {
        data: null,
        error: { message: `fetchAll: больше ${maxRows} строк — проверьте фильтры запроса` },
      };
    }
  }

  return { data: rows, error: null };
}

/** Сколько id класть в один `.in(...)`: ~150 × 37 символов ≈ 5.5 КБ URL. */
export const DEFAULT_ID_CHUNK = 150;

/**
 * Выборка по большому списку id: пачками по `chunkSize`, каждая пачка —
 * через fetchAll. `build` должен вернуть НОВЫЙ билдер для пачки.
 *
 *   fetchAllByIds(tripIds, (ids) =>
 *     supabase.from('trip_segments').select('...').in('trip_id', ids))
 */
export async function fetchAllByIds<Q extends PageableQuery>(
  ids: readonly string[],
  build: (chunk: string[]) => Q,
  options: FetchAllOptions & { chunkSize?: number } = {}
): Promise<FetchAllResult<RowOf<Q>>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return { data: [], error: null };

  const chunkSize = options.chunkSize ?? DEFAULT_ID_CHUNK;
  const rows: RowOf<Q>[] = [];

  for (let i = 0; i < unique.length; i += chunkSize) {
    const res = await fetchAll(build(unique.slice(i, i + chunkSize)), options);
    if (res.error) return res;
    rows.push(...res.data);
  }

  return { data: rows, error: null };
}
