import Link from 'next/link';
import { redirect } from 'next/navigation';
import { can } from '../../../lib/roles';
import { getSessionContext } from '../../../lib/session';
import { createManager } from '../actions';
import SubmitButton from '../../components/SubmitButton';
import { ArrowLeft, UserPlus, Save } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NewManagerPage() {
  const { role } = await getSessionContext();
  if (role === 'driver') redirect('/driver');
  if (!can(role, 'managers.edit')) redirect('/');

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <Link
          href="/managers"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          К списку менеджеров
        </Link>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <UserPlus className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            Новый менеджер
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Карточка менеджера. Заказы назначаются на него из карточки заказа.
          </p>
        </div>

        <form action={createManager} className="card p-5 md:p-6 space-y-5">
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 mb-1">
              Имя и фамилия <span className="text-red-500">*</span>
            </label>
            <input
              id="full_name"
              name="full_name"
              required
              className="input"
              placeholder="Иванов Иван"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
                Телефон
              </label>
              <input id="phone" name="phone" className="input" placeholder="+375 29 000 00 00" />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                E-mail
              </label>
              <input id="email" name="email" type="email" className="input" placeholder="manager@example.com" />
              <p className="text-xs text-slate-500 mt-1">
                По этому e-mail менеджер входит в систему. Учётную запись создаёт администратор.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="telegram_chat_id" className="block text-sm font-medium text-slate-700 mb-1">
              Telegram chat ID
            </label>
            <input id="telegram_chat_id" name="telegram_chat_id" className="input" placeholder="123456789" />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
              Заметки
            </label>
            <textarea id="notes" name="notes" rows={3} className="input" placeholder="Зона ответственности, график и т.п." />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <Link
              href="/managers"
              className="btn btn-secondary w-full sm:w-auto text-center"
            >
              Отмена
            </Link>
            <SubmitButton
              className="btn btn-primary w-full sm:w-auto text-center"
              pendingText="Сохраняю менеджера…"
            >
              <Save className="w-4 h-4" strokeWidth={2} />
              Сохранить
            </SubmitButton>
          </div>
        </form>
      </div>
    </main>
  );
}
