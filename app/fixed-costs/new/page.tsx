import { supabase } from '../../../lib/supabaseClient';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

async function createFixedCost(formData: FormData) {
  'use server';

  const monthKey = formData.get('month_key') as string;
  const category = formData.get('category') as string;
  const amountPln = parseFloat(formData.get('amount_pln') as string) || 0;
  const amountEur = parseFloat(formData.get('amount_eur') as string) || 0;

  const { error } = await supabase
    .from('fixed_costs')
    .insert([
      {
        month_key: monthKey,
        category: category,
        amount_pln: amountPln || null,
        amount_eur: amountEur || null
      }
    ]);

  if (error) throw new Error(`Ошибка добавления: ${error.message}`);
  revalidatePath('/fixed-costs');
  redirect('/fixed-costs');
}

export default function NewFixedCostPage() {
  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";
  const sectionClass = "bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4";
  const sectionTitleClass = "text-lg font-bold text-slate-900 mb-2 flex items-center gap-2";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">

        <a href="/fixed-costs" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все общие расходы
        </a>

        <div>
          <h1 className="text-3xl font-bold text-slate-900">➕ Добавить общий расход</h1>
          <p className="text-slate-500 mt-1">Затрата, не привязанная к конкретному рейсу</p>
        </div>

        <form action={createFixedCost} className="space-y-6">

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>💶 Данные расхода</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Месяц *</label>
                <input type="month" name="month_key" required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Категория *</label>
                <input
                  type="text"
                  name="category"
                  required
                  placeholder="Например: Страховка, Бухгалтерия"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Сумма (PLN)</label>
                <input type="number" name="amount_pln" step="0.01" placeholder="0.00" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Сумма (EUR)</label>
                <input type="number" name="amount_eur" step="0.01" placeholder="0.00" className={inputClass} />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl
                         shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]"
            >
              ✅ Сохранить расход
            </button>
            <a
              href="/fixed-costs"
              className="px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                         hover:bg-slate-100 transition-all duration-150"
            >
              Отмена
            </a>
          </div>

        </form>
      </div>
    </main>
  );
}
