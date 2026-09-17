import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

type MonthGroup = {
  month_key: string;
  items: any[];
  total: number;
};

export default async function FixedCostsPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const { data: costs, error } = await supabase
    .from('fixed_costs')
    .select('*')
    .order('month_key', { ascending: false });

  if (error) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;
  }

  const costsByMonth: Record<string, MonthGroup> = {};
  costs?.forEach((c) => {
    if (!c.month_key) return;
    if (!costsByMonth[c.month_key]) {
      costsByMonth[c.month_key] = { month_key: c.month_key, items: [], total: 0 };
    }
    costsByMonth[c.month_key].items.push(c);
    costsByMonth[c.month_key].total += c.amount_eur || 0;
  });

  const months: MonthGroup[] = Object.values(costsByMonth);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">

        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">💶 Общие расходы</h1>
            <p className="text-slate-500 mt-1">Расходы, не привязанные к конкретному рейсу — по месяцам</p>
          </div>
          <a
            href="/fixed-costs/new"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                       font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/20
                       transition-all duration-150 active:scale-[0.98]"
          >
            <span>➕</span>
            <span>Добавить расход</span>
          </a>
        </div>

        {months.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">💶</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Расходов пока нет</h2>
            <p className="text-slate-500 mb-6">Добавьте первый общий расход</p>
          </div>
        ) : (
          <div className="space-y-5">
            {months.map((m) => (
              <div key={m.month_key} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl">📅</div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {new Date(m.month_key + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                    </h2>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-slate-400 font-medium">Итого за месяц</div>
                    <div className="text-xl font-bold text-red-500">{m.total.toFixed(2)} €</div>
                  </div>
                </div>

                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Категория</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">PLN</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">EUR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.items.map((c: any) => (
                      <tr key={c.id} className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-800">
                          {c.category || 'Без категории'}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600">
                          {c.amount_pln ? `${c.amount_pln} PLN` : '—'}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-red-500">
                          {c.amount_eur ? `${c.amount_eur} €` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
