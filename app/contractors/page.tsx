import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import { deleteContractor } from './actions';

export const dynamic = 'force-dynamic';

export default async function ContractorsPage() {
  const cookieStore = cookies();
  const role = cookieStore.get('role')?.value;
  if (role !== 'office') redirect('/login');

  const supabase = await createClient();

  const { data: contractors, error } = await supabase
    .from('contractors')
    .select('*')
    .order('name');

  if (error) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1000px] mx-auto px-6 py-8 space-y-6">

        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">🤝 Подрядчики</h1>
            <p className="text-slate-500 mt-1">Фирмы, которых мы нанимаем для экспедирования</p>
          </div>
          <a
            href="/contractors/new"
            className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold
                       shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]"
          >
            ➕ Добавить подрядчика
          </a>
        </div>

        {(!contractors || contractors.length === 0) ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">🤝</div>
            <p className="text-slate-500 mb-4">Пока нет ни одного подрядчика</p>
            <a
              href="/contractors/new"
              className="inline-block px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all"
            >
              Добавить первого
            </a>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Название</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Телефон</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Заметки</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {contractors.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{c.name}</div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} className="hover:text-blue-600">
                          {c.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-500 max-w-[300px] truncate">
                      {c.notes || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <a
                          href={`/contractors/${c.id}/edit`}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium
                                     hover:bg-slate-100 transition-all"
                        >
                          ✏️
                        </a>
                        <form action={deleteContractor.bind(null, c.id)}>
                          <button
                            type="submit"
                            className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 border border-red-500/30
                                       text-xs font-medium hover:bg-red-500 hover:text-white transition-all"
                          >
                            🗑️
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </main>
  );
}
