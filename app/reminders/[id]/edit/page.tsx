import { createClient } from '../../../../lib/supabase-server';
import { updateReminder } from '../../actions';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function EditReminderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: reminder, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !reminder) {
    return <div className="p-8 text-red-500">Напоминание не найдено</div>;
  }

  // Авто-напоминания не редактируются
  const isAuto = reminder.entity_type !== null && reminder.entity_id !== null;
  if (isAuto) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="max-w-[700px] mx-auto px-6 py-8 space-y-6">
          <a href="/reminders" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 text-sm font-medium">
            ← Все напоминания
          </a>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <div className="text-4xl mb-3">🔒</div>
            <h2 className="text-lg font-bold text-amber-900 mb-2">Это автоматическое напоминание</h2>
            <p className="text-amber-800 text-sm">
              Оно создано из карточки {reminder.entity_type === 'driver' ? 'водителя' : 'машины'} и обновляется автоматически
              при изменении срока документа. Чтобы изменить дату — отредактируйте документ в карточке.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";
  const sectionClass = "bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4";
  const sectionTitleClass = "text-lg font-bold text-slate-900 mb-2 flex items-center gap-2";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">

        <a href="/reminders" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все напоминания
        </a>

        <div>
          <h1 className="text-3xl font-bold text-slate-900">✏️ Редактировать напоминание</h1>
        </div>

        <form action={updateReminder.bind(null, id)} className="space-y-6">

          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>⏰ Данные напоминания</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelClass}>Название *</label>
                <input
                  type="text"
                  name="title"
                  required
                  defaultValue={reminder.title || ''}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Категория *</label>
                <select name="category" required defaultValue={reminder.category || 'insurance'} className={inputClass}>
                  <option value="insurance">🛡 Страховка</option>
                  <option value="inspection">🔧 Техосмотр</option>
                  <option value="driver_doc">📄 Документы водителя</option>
                  <option value="payment_to_contractor">🚛 Подрядчик</option>
                  <option value="accounting">💰 Бухгалтерия</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Срок (дата) *</label>
                <input
                  type="date"
                  name="due_date"
                  required
                  defaultValue={reminder.due_date || ''}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Сумма (€) — если есть</label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  placeholder="0.00"
                  defaultValue={reminder.amount || ''}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl
                         shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]"
            >
              ✅ Сохранить изменения
            </button>
            <a
              href="/reminders"
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
