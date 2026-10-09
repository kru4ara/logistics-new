import { createReminder } from '../actions';
import SubmitButton from '../../components/SubmitButton';
import { ArrowLeft, Bell, Calendar, Save } from 'lucide-react';

export default function NewReminderPage() {
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
            <Bell className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            Добавить напоминание
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Напоминание будет показано в разделе «Напоминания» и в Telegram
          </p>
        </div>

        <form action={createReminder} className="space-y-4 md:space-y-6">

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
                  placeholder="Например: Страховка DAF, Оплата бухгалтерии…"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Категория *</label>
                <select name="category" required className="input">
                  <option value="insurance">Страховка</option>
                  <option value="inspection">Техосмотр</option>
                  <option value="driver_doc">Документы водителя</option>
                  <option value="payment_to_contractor">Подрядчик</option>
                  <option value="accounting">Бухгалтерия</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Срок (дата) *</label>
                <input type="date" name="due_date" required className="input" />
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
              pendingText="Сохраняю напоминание…"
            >
              <Save className="w-4 h-4" strokeWidth={2.5} />
              Сохранить напоминание
            </SubmitButton>
          </div>

        </form>
      </div>
    </main>
  );
}
