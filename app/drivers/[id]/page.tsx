import { createClient } from '../../../lib/supabase-server';
import DocumentUpload from '../../components/DocumentUpload';

export const dynamic = 'force-dynamic';

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: driverId } = await params;
  if (!driverId) return <div className="p-8">Ошибка: ID водителя не передан</div>;

  const supabase = await createClient();

  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driverId)
    .single();

  if (driverError) return <div className="p-8 text-red-500">Ошибка загрузки: {driverError.message}</div>;

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('entity_type', 'driver')
    .eq('entity_id', driverId);

  function getDaysUntil(dateString: string | null) {
    if (!dateString) return null;
    const today = new Date();
    const target = new Date(dateString);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  function daysBadge(dateString: string | null) {
    const days = getDaysUntil(dateString);
    if (days === null) return { color: 'bg-slate-100 text-slate-500 border-slate-200', label: '—' };
    if (days < 0) return { color: 'bg-red-50 text-red-700 border-red-200', label: `${days} дн.` };
    if (days < 30) return { color: 'bg-orange-50 text-orange-700 border-orange-200', label: `${days} дн.` };
    return { color: 'bg-green-50 text-green-700 border-green-200', label: `${days} дн.` };
  }

  const initials = `${driver.first_name?.[0] || ''}${driver.last_name?.[0] || ''}`.toUpperCase();

  const documentFields = [
    { label: 'Паспорт', value: driver.passport_expiry, icon: '📕' },
    { label: 'Виза', value: driver.visa_expiry, icon: '🛂' },
    { label: 'Водительское', value: driver.license_expiry, icon: '🚗' },
    { label: 'Карта тахографа', value: driver.tachograph_card_expiry, icon: '💳' },
    { label: 'Код 95', value: driver.code_95_expiry, icon: '📜' },
    { label: 'АДР', value: driver.adr_expiry, icon: '⚠️' },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">

        <a href="/drivers" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все водители
        </a>

        {/* Шапка профиля */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700
                              flex items-center justify-center text-white font-bold text-2xl shrink-0">
                {initials || '👤'}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {driver.first_name} {driver.last_name}
                </h1>
                <p className="text-slate-500 mt-1">
                  📞 {driver.phone || 'Телефон не указан'}
                </p>
              </div>
            </div>

            <a
              href={`/drivers/${driverId}/edit`}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                         font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/20
                         transition-all duration-150 active:scale-[0.98]"
            >
              ✏️ Редактировать
            </a>
          </div>
        </div>

        {/* Личные данные */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Личные данные</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Дата рождения</div>
              <div className="text-slate-800 font-medium">
                {driver.date_of_birth ? new Date(driver.date_of_birth).toLocaleDateString('ru-RU') : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Паспорт</div>
              <div className="text-slate-800 font-medium">{driver.passport_number || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Адрес</div>
              <div className="text-slate-800 font-medium">{driver.address || '—'}</div>
            </div>
          </div>
        </div>

        {/* Сроки документов */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">📅 Сроки документов</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {documentFields.map((doc) => {
              const badge = daysBadge(doc.value);
              return (
                <div key={doc.label} className="border border-slate-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{doc.icon}</span>
                    <span className="text-sm font-semibold text-slate-700">{doc.label}</span>
                  </div>
                  <div className="text-slate-800 font-medium mb-2">
                    {doc.value ? new Date(doc.value).toLocaleDateString('ru-RU') : '—'}
                  </div>
                  <div className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.color}`}>
                    {badge.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Загруженные документы */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">📁 Загруженные файлы</h2>
          {documents?.length === 0 ? (
            <div className="text-slate-400 text-center py-8">Файлы ещё не загружены</div>
          ) : (
            <div className="space-y-2">
              {documents?.map((doc) => (
                <div key={doc.id} className="flex justify-between items-center border border-slate-100 rounded-xl p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl">📄</span>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 truncate">{doc.document_type}</div>
                      <div className="text-xs text-slate-400">
                        {doc.expiry_date ? `до ${new Date(doc.expiry_date).toLocaleDateString('ru-RU')}` : 'без срока'}
                      </div>
                    </div>
                  </div>
                  <a
                    href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${doc.file_path}`}
                    target="_blank"
                    className="text-blue-600 hover:underline font-medium text-sm whitespace-nowrap"
                  >
                    Смотреть
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Загрузка документов */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <DocumentUpload entityType="driver" entityId={driverId} />
        </div>

      </div>
    </main>
  );
}
