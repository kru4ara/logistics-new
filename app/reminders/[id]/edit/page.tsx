import { createClient } from '../../../../lib/supabase-server';
import { updateReminder } from '../../actions';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import SubmitButton from '../../../components/SubmitButton';
import { ArrowLeft, Bell, Pencil, Lock, Save } from 'lucide-react';

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
        <div className="max-w-[700px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">
          <a
            href="/reminders"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            Все напоминания
          </a>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 md:p-6">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
              <Lock className="w-6 h-6 text-amber-700" strokeWidth={2.2} />
            </div>
            <h2 className="text-lg font-bold text-amber-900 mb-2">
              Это автоматическое напоминание
            </h2>
            <p className="text-amber-800 text-sm">
              Оно создано из карточки {reminder.entity_type === 'driver' ? 'водителя' : 'машины'} и обновляется автоматически
              при изменении срока документа. Чтобы изменить дату — отредактируйте документ в карточке.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a
          href="/reminders"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Все напоминания
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <Pencil className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            Редактировать напоминание
          </h1>
        </div>

        <form action={updateReminder.bind(null, id)} className="space-y-4 md:space-y-6">

          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-brand-600" strokeWidth={2} />
              Данные напоминания
            </h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Название *</label>
                <input
                  type="text"
                  name="title"
                  required
                  defaultValue={reminder.title || ''}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Категория *</label>
                <select
                  name="category"
                  required
                  defaultValue={reminder.category || 'insurance'}
                  className="input"
                >
                  <option value="insurance">Страховка</option>
                  <option value="inspection">Техосмотр</option>
                  <option value="driver_doc">Документы водителя</option>
                  <option value="payment_to_contractor">Подрядчик</option>
                  <option value="accounting">Бухгалтерия</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Срок (дата) *</label>
                <input
                  type="date"
                  name="due_date"
                  required
                  defaultValue={reminder.due_date || ''}
                  className="input"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Сумма (€) — если есть
                </label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  placeholder="0.00"
                  defaultValue={reminder.amount || ''}
                  className="input"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-3 sm:static
                          bg-slate-50/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none
                          -mx-4 px-4 sm:mx-0 sm:px-0 py-3 sm:py-0
                          border-t sm:border-0 border-slate-200">
            <a
              href="/reminders"
              className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                         hover:bg-slate-100 transition-all duration-150"
            >
              Отмена
            </a>
            <SubmitButton
              className="btn btn-primary w-full sm:flex-1 py-3"
              pendingText="Сохраняю изменения…"
            >
              <Save className="w-4 h-4" strokeWidth={2.5} />
              Сохранить изменения
            </SubmitButton>
          </div>

        </form>
      </div>
    </main>
  );
}
