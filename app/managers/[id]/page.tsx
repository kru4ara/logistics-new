import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/admin';
import { can } from '../../../lib/roles';
import { getSessionContext } from '../../../lib/session';
import { updateManager, linkManagerUser, setManagerPassword } from '../actions';
import SubmitButton from '../../components/SubmitButton';
import {
  ArrowLeft,
  Briefcase,
  Phone,
  Mail,
  MessageCircle,
  Package,
  Save,
  Link2,
  KeyRound,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const statusLabels: Record<string, string> = {
  planned: 'Планируется',
  active: 'В пути',
  completed: 'Завершён',
  invoiced: 'Выставлен счёт',
  paid: 'Оплачен',
};

export default async function ManagerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: managerId } = await params;
  const { role } = await getSessionContext();
  if (role === 'driver') redirect('/driver');
  if (!can(role, 'managers.view')) redirect('/');

  if (!managerId) return <div className="p-8">Ошибка: ID менеджера не передан</div>;

  const supabase = await createClient();

  const { data: manager, error } = await supabase
    .from('managers')
    .select('*')
    .eq('id', managerId)
    .single();

  if (error) return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;

  // Профиль, привязанный к этой карточке менеджера.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('manager_id', managerId)
    .maybeSingle();

  const { data: trips } = await supabase
    .from('trips')
    .select('id, trip_number, status, start_date, end_date, revenue_eur, manager_id')
    .eq('manager_id', managerId)
    .order('start_date', { ascending: false })
    .limit(100);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <Link
          href="/managers"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          К списку менеджеров
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
            <Briefcase className="w-6 h-6 text-brand-600" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              {manager.full_name}
            </h1>
            <p className="text-slate-500 text-sm">
              {manager.active !== false ? 'Активен' : 'Отключён'}
              {profile ? ' · учётная запись привязана' : ' · учётная запись не привязана'}
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Карточка менеджера */}
          <form action={updateManager} className="card p-5 md:p-6 space-y-5">
            <h2 className="text-lg font-bold text-slate-900">Данные менеджера</h2>

            <input type="hidden" name="manager_id" value={manager.id} />
            <input type="hidden" name="active" value={manager.active !== false ? 'true' : 'false'} />

            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 mb-1">
                Имя и фамилия
              </label>
              <input id="full_name" name="full_name" required className="input" defaultValue={manager.full_name || ''} />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
                  Телефон
                </label>
                <input id="phone" name="phone" className="input" defaultValue={manager.phone || ''} />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                  E-mail
                </label>
                <input id="email" name="email" type="email" className="input" defaultValue={manager.email || ''} />
              </div>
            </div>

            <div>
              <label htmlFor="telegram_chat_id" className="block text-sm font-medium text-slate-700 mb-1">
                Telegram chat ID
              </label>
              <input id="telegram_chat_id" name="telegram_chat_id" className="input" defaultValue={manager.telegram_chat_id || ''} />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
                Заметки
              </label>
              <textarea id="notes" name="notes" rows={3} className="input" defaultValue={manager.notes || ''} />
            </div>

            <div className="flex justify-end pt-2">
              <SubmitButton
                className="btn btn-primary text-center"
                pendingText="Сохраняю менеджера…"
              >
                <Save className="w-4 h-4" strokeWidth={2} />
                Сохранить
              </SubmitButton>
            </div>
          </form>

          {/* Логин и пароль менеджера */}
          <form action={setManagerPassword} className="card p-5 md:p-6 space-y-5">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-slate-400" strokeWidth={2} />
              Логин и пароль
            </h2>

            <p className="text-sm text-slate-600">
              Логин менеджера — его e-mail. Пароль задаёт офис: учётная запись
              создаётся автоматически, а профиль получает роль
              <b> manager</b> и ссылку на эту карточку. Менеджер сможет войти
              и по e-mail, и по имени (например «ANATOLI KURLIUK»).
            </p>

            <input type="hidden" name="manager_id" value={manager.id} />

            <div>
              <label htmlFor="login_email" className="block text-sm font-medium text-slate-700 mb-1">
                Логин (e-mail)
              </label>
              <input
                id="login_email"
                name="email"
                type="email"
                required
                className="input"
                defaultValue={manager.email || ''}
                placeholder="manager@example.com"
              />
            </div>

            <div>
              <label htmlFor="manager_password" className="block text-sm font-medium text-slate-700 mb-1">
                Пароль
              </label>
              <input
                id="manager_password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="input"
                placeholder="Не короче 6 символов"
              />
              <p className="text-xs text-slate-500 mt-1">
                Пароль нигде не хранится и не показывается. Чтобы задать или
                сменить его, введите новый и нажмите «Сохранить пароль».
              </p>
            </div>

            {manager.password_updated_at && (
              <p className="text-xs text-slate-500">
                Последний раз пароль задан: {new Date(manager.password_updated_at).toLocaleString('ru-RU')}
              </p>
            )}

            <div className="flex justify-end pt-2">
              <SubmitButton
                className="btn btn-primary text-center"
                pendingText="Сохраняю пароль…"
              >
                <Save className="w-4 h-4" strokeWidth={2} />
                Сохранить пароль
              </SubmitButton>
            </div>
          </form>

          {/* Учётная запись */}
          <form action={linkManagerUser} className="card p-5 md:p-6 space-y-5">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-slate-400" strokeWidth={2} />
              Учётная запись
            </h2>

            <p className="text-sm text-slate-600">
              Чтобы менеджер вошёл в систему, у его профиля должна быть роль
              <b> manager</b> и ссылка на эту карточку. Учётную запись Supabase
              создаёт администратор; здесь указываем её e-mail — этого достаточно,
              чтобы войти по логину.
            </p>

            <input type="hidden" name="manager_id" value={manager.id} />

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                E-mail учётной записи
              </label>
              <input id="email" name="email" type="email" className="input" defaultValue={manager.email || ''} />
            </div>

            <div>
              <label htmlFor="user_id" className="block text-sm font-medium text-slate-700 mb-1">
                ID учётной записи (auth.users)
              </label>
              <input id="user_id" name="user_id" className="input" defaultValue={manager.user_id || ''} placeholder="UUID" />
              <p className="text-xs text-slate-500 mt-1">
                Необязательно, если e-mail уже совпадает с e-mail учётной записи.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <SubmitButton
                className="btn btn-primary text-center"
                pendingText="Привязываю…"
              >
                <Link2 className="w-4 h-4" strokeWidth={2} />
                Привязать
              </SubmitButton>
            </div>
          </form>
        </div>

        {/* Заказы менеджера */}
        <div className="card p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-slate-400" strokeWidth={2} />
            Заказы менеджера
            <span className="text-sm font-normal text-slate-500">({trips?.length || 0})</span>
          </h2>

          {!trips || trips.length === 0 ? (
            <p className="text-slate-500 text-sm">Заказов пока нет.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-4 font-medium">№</th>
                    <th className="py-2 pr-4 font-medium">Статус</th>
                    <th className="py-2 pr-4 font-medium">Начало</th>
                    <th className="py-2 pr-4 font-medium">Финиш</th>
                    <th className="py-2 font-medium text-right">Выручка</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 pr-4">
                        <Link href={`/trips/${t.id}`} className="font-medium text-brand-600 hover:underline">
                          {t.trip_number}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-slate-600">
                        {statusLabels[t.status || ''] || t.status}
                      </td>
                      <td className="py-2 pr-4 text-slate-600">{t.start_date || '—'}</td>
                      <td className="py-2 pr-4 text-slate-600">{t.end_date || '—'}</td>
                      <td className="py-2 text-right font-medium">
                        {t.revenue_eur != null ? `${t.revenue_eur} €` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
