import { supabase } from '../../../lib/supabaseClient';
import DocumentUpload from '../../components/DocumentUpload';

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: driverId } = await params;
  
  if (!driverId) return <div>Ошибка: ID водителя не передан</div>;

  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driverId)
    .single();

  if (driverError) return <div>Ошибка загрузки: {driverError.message}</div>;

  const { data: documents, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('entity_type', 'driver')
    .eq('entity_id', driverId);

  if (docError) return <div>Ошибка загрузки документов: {docError.message}</div>;

  // Функция для подсчёта дней до даты
  function getDaysLeft(dateString: string | null) {
    if (!dateString) return null;
    const today = new Date();
    const target = new Date(dateString);
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  // Список документов с индикацией сроков
  const docsWithStatus = documents?.map(doc => ({
    ...doc,
    daysLeft: getDaysLeft(doc.expiry_date)
  })) || [];

  return (
    <main style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px' }}>Карточка водителя: {driver.first_name} {driver.last_name}</h1>
        <a href="/drivers" style={{ color: '#0070f3' }}>← Все водители</a>
      </div>

      {/* Основная информация */}
      <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', marginTop: '15px' }}>
        <h3 style={{ marginTop: 0 }}>Личные данные</h3>
        <p><strong>Дата рождения:</strong> {driver.date_of_birth || '-'}</p>
        <p><strong>Адрес:</strong> {driver.address || '-'}</p>
        <p><strong>Телефон:</strong> {driver.phone || '-'}</p>
        <p><strong>Паспорт:</strong> {driver.passport_number || '-'} (выдан: {driver.passport_issued_by || '-'})</p>
        <p><strong>Срок паспорта:</strong> {driver.passport_expiry ? new Date(driver.passport_expiry).toLocaleDateString('ru-RU') : '-'}</p>
        <p><strong>Водительское удостоверение:</strong> {driver.license_number || '-'} (категории: {driver.license_categories || '-'})</p>
        <p><strong>Срок прав:</strong> {driver.license_expiry ? new Date(driver.license_expiry).toLocaleDateString('ru-RU') : '-'}</p>
        <p><strong>Карта водителя:</strong> {driver.tachograph_card_number || '-'}</p>
        <p><strong>Срок карты:</strong> {driver.tachograph_card_expiry ? new Date(driver.tachograph_card_expiry).toLocaleDateString('ru-RU') : '-'}</p>
        <p><strong>Код 95 до:</strong> {driver.code_95_expiry ? new Date(driver.code_95_expiry).toLocaleDateString('ru-RU') : '-'}</p>
        <p><strong>АДР до:</strong> {driver.adr_expiry ? new Date(driver.adr_expiry).toLocaleDateString('ru-RU') : '-'}</p>
      </div>

      {/* Список документов */}
      <div style={{ marginTop: '25px' }}>
        <h2>📁 Документы</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
              <th style={{ padding: '10px' }}>Тип</th>
              <th style={{ padding: '10px' }}>Срок действия</th>
              <th style={{ padding: '10px' }}>Осталось дней</th>
              <th style={{ padding: '10px' }}>Файл</th>
            </tr>
          </thead>
          <tbody>
            {docsWithStatus.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Пока нет загруженных документов</td></tr>
            ) : (
              docsWithStatus.map(doc => (
                <tr key={doc.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{doc.document_type}</td>
                  <td style={{ padding: '10px' }}>{doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString('ru-RU') : '—'}</td>
                  <td style={{ padding: '10px' }}>
                    {doc.daysLeft !== null ? (
                      <span style={{ color: doc.daysLeft < 0 ? 'red' : doc.daysLeft < 30 ? 'orange' : 'green', fontWeight: 'bold' }}>
                        {doc.daysLeft} дн.
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <a href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${doc.file_path}`} target="_blank" style={{ color: '#0070f3' }}>Смотреть</a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Загрузка документа */}
      <DocumentUpload entityType="driver" entityId={driverId} onUploaded={() => {}} />
    </main>
  );
}
