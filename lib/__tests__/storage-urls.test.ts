import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

const calls: Array<{ bucket: string; paths: string[]; ttl: number }> = [];
let fail = false;

vi.mock('../supabase/admin', () => ({
  createClient: async () => ({
    storage: {
      from: (bucket: string) => ({
        createSignedUrls: async (paths: string[], ttl: number) => {
          calls.push({ bucket, paths, ttl });
          if (fail) return { data: null, error: { message: 'boom' } };
          return {
            data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${p}?token=t`, error: null })),
            error: null,
          };
        },
      }),
    },
  }),
}));

import { signDocumentPaths, withSignedUrls, SIGNED_URL_TTL_SEC } from '../storage-urls';

beforeEach(() => {
  calls.length = 0;
  fail = false;
});

describe('signDocumentPaths', () => {
  it('подписывает пачкой в бакете documents на час, без дублей и пустых путей', async () => {
    const urls = await signDocumentPaths(['a.pdf', null, 'b.jpg', 'a.pdf', undefined, '']);
    expect(calls).toEqual([{ bucket: 'documents', paths: ['a.pdf', 'b.jpg'], ttl: SIGNED_URL_TTL_SEC }]);
    expect(SIGNED_URL_TTL_SEC).toBe(3600);
    expect(urls).toEqual({ 'a.pdf': 'https://signed/a.pdf?token=t', 'b.jpg': 'https://signed/b.jpg?token=t' });
  });

  it('нет путей — нет запроса', async () => {
    expect(await signDocumentPaths([null, ''])).toEqual({});
    expect(calls).toHaveLength(0);
  });

  it('ошибка хранилища — пустой результат, а не исключение на странице', async () => {
    fail = true;
    expect(await signDocumentPaths(['a.pdf'])).toEqual({});
  });
});

describe('withSignedUrls', () => {
  it('добавляет url; документ без файла — url null; публичных адресов нет', async () => {
    const docs = await withSignedUrls([
      { id: '1', file_path: 'trips/1/cmr.pdf' },
      { id: '2', file_path: null },
    ]);
    expect(docs).toEqual([
      { id: '1', file_path: 'trips/1/cmr.pdf', url: 'https://signed/trips/1/cmr.pdf?token=t' },
      { id: '2', file_path: null, url: null },
    ]);
    expect(JSON.stringify(docs)).not.toContain('/object/public/');
  });
});

describe('сторож: нет публичных адресов файлов', () => {
  it('в app/ и lib/ никто не строит /storage/v1/object/public/ (бакет закрытый)', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join, resolve, relative } = await import('node:path');
    const root = resolve(__dirname, '../..');
    const walk = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        if (['node_modules', '__tests__', '.next'].includes(n)) return [];
        const p = join(d, n);
        return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : [];
      });
    const offenders = [...walk(join(root, 'app')), ...walk(join(root, 'lib'))]
      .filter((f) => !f.endsWith('storage-urls.ts'))
      .filter((f) => /object\/public\//.test(readFileSync(f, 'utf8')))
      .map((f) => relative(root, f));
    expect(offenders).toEqual([]);
  });
});
