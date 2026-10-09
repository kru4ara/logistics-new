import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import { deleteLocation } from './actions';
import {
  MapPin,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Building2,
  User as UserIcon,
  Globe,
  DoorOpen,
  Pencil,
  Trash2,
  Inbox,
  type LucideIcon,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

type LocationType = 'loading' | 'unloading' | 'both';

const typeMeta: Record<LocationType, {
  label: string;
  Icon: LucideIcon;
  badge: string;
  iconBg: string;
}> = {
  loading: {
    label: 'Погрузка',
    Icon: ArrowDownToLine,
    badge: 'bg-green-50 text-green-700 border-green-200',
    iconBg: 'bg-green-50 text-green-600',
  },
  unloading: {
    label: 'Выгрузка',
    Icon: ArrowUpFromLine,
    badge: 'bg-brand-50 text-brand-700 border-brand-200',
    iconBg: 'bg-brand-50 text-brand-600',
  },
  both: {
    label: 'Универсально',
    Icon: ArrowLeftRight,
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    iconBg: 'bg-slate-100 text-slate-600',
  },
};

export default async function LocationsPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: locations, error } = await supabase
    .from('locations')
    .select('*')
    .order('name', { ascending: true });

  if (error) return <div className="p-8 text-red-500">Ошибка: {error.message}</div>;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <MapPin className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
              Локации
            </h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              Всего: <b className="text-slate-700">{locations?.length || 0}</b> типовых адресов
            </p>
          </div>
          <a
            href="/locations/new"
            className="btn btn-primary text-sm md:text-base w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={2.5} />
            Добавить локацию
          </a>
        </div>

        {locations?.length === 0 ? (
          <div className="card p-10 md:p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Локаций пока нет</h2>
            <p className="text-slate-500 mb-6">Добавьте типовые адреса, чтобы не вводить их каждый раз</p>
            <a href="/locations/new" className="btn btn-primary inline-flex">
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Добавить первую локацию
            </a>
          </div>
        ) : (
          <div className="grid gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((loc) => {
              const meta = typeMeta[loc.type as LocationType] || typeMeta.both;
              const TypeIcon = meta.Icon;

              return (
                <div
                  key={loc.id}
                  className="card card-hover flex flex-col"
                >
                  <div className="p-5 flex-1">
                    {/* Заголовок */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-11 h-11 rounded-xl ${meta.iconBg} flex items-center justify-center shrink-0`}>
                        <TypeIcon className="w-5 h-5" strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 break-words">
                          {loc.name}
                        </div>
                        <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.badge}`}>
                          <TypeIcon className="w-3 h-3" strokeWidth={2.2} />
                          {meta.label}
                        </span>
                      </div>
                    </div>

                    {/* Информация */}
                    <div className="space-y-2 text-sm text-slate-600">
                      {loc.company_name && (
                        <div className="flex items-start gap-2">
                          <Building2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" strokeWidth={2} />
                          <span className="font-medium text-slate-800 break-words">{loc.company_name}</span>
                        </div>
                      )}
                      {loc.contact_person && (
                        <div className="flex items-start gap-2">
                          <UserIcon className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" strokeWidth={2} />
                          <span className="break-words">{loc.contact_person}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <Globe className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" strokeWidth={2} />
                        <span className="break-words text-xs">
                          {[loc.postal_code, loc.city, loc.address, loc.country].filter(Boolean).join(', ') || '—'}
                        </span>
                      </div>
                      {loc.default_loading_number && (
                        <div className="flex items-start gap-2">
                          <DoorOpen className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" strokeWidth={2} />
                          <span className="break-words text-xs">
                            Погрузка: <b className="tabular-nums">{loc.default_loading_number}</b>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Кнопки */}
                  <div className="p-3 border-t border-slate-100 bg-slate-50/40 flex gap-2">
                    <a
                      href={`/locations/${loc.id}/edit`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium
                                 hover:bg-white transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                      Изменить
                    </a>
                    <form action={deleteLocation.bind(null, loc.id)} className="flex-1">
                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-600 border border-red-500/30
                                   text-xs font-medium hover:bg-red-500 hover:text-white transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                        Удалить
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}
