import { supabase } from '../../../lib/supabaseClient';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

async function createReminder(formData: FormData) {
  'use server';

  const title = formData.get('title') as string;
  const category = formData.get('category') as string;
  const dueDate = formData.get('due_date') as string;
  const amount = parseFloat(formData.get('amount') as string) || 0;

  const { error } = await supabase
    .from('reminders')
    .insert([
      {
        title: title,
        category: category,
        due_date: dueDate,
        amount: amount || null,
        status: 'active'
      }
    ]);

  if (error) throw new Error(`Ошибка добавления: ${error.message}`);
  revalidatePath('/reminders');
  redirect('/reminders');
}

export default function NewReminderPage() {
  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";
  const sectionClass = "bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4";
  const sectionTitleClass = "text-lg font-bold text-slate-900 mb-2 flex items-center gap-2";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">

        {/* Назад */}
        <a href="/reminders" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все напоминания
        </a>

        {/* Заголовок */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">➕ Добавить напоминание</h1>
          <p className="text-slate-500 mt-1">Напоминание будет показано в разделе "Напоминания" и в Telegram</p>
        </div>

        <form action={createReminder} className="space-y-6">

          {/* Основные данные */}
          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>⏰ Данные напоминания</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelClass}>Название *</label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="Например: Страховка DAF, Оплата бухгалтерии..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Категория *</label>
                <select name="category" required className={inputClass}>
                  <option value="insurance">🛡 Страховка</option>
                  <option value="inspection">🔧 Техосмотр</option>
                  <option value="driver_doc">📄 Документы водителя</option>
                  <option value="payment_to_contractor">🚛 Подрядчик</option>
                  <option value="accounting">💰 Бухгалтерия</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Срок (дата) *</label>
                <input type="date" name="due_date" required className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Сумма (€) — если есть</label>
                <input type="number" name="amount" step="0.01" placeholder="0.00" className={inputClass} />
              </div>
            </div>
          </div>

          {/* Кнопки */}
          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl
                         shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]"
            >
              ✅ Сохранить напоминание
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
