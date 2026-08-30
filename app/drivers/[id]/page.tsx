import { supabase } from '../../../lib/supabaseClient';
import { createReminderFromDriver } from '../../driver/reminders-actions';
import { sendDriverNotification } from '../../driver/telegram-actions';

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: driverId } = await params;
  
  if (!driverId) {
    return <div>Ошибка: ID водителя не передан</div>;
  }

  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driverId)
    .single();

  if (driverError) {
    return <div>Ошибка загрузки: {driverError.message}</div>;
  }

  // Выращиваем систему автоматического создания напоминаний
  if (driver.visa_expiry) {
    await createReminderFromDriver(driverId, `Виза: ${driver.first_name} ${driver.last_name}`, driver.visa_expiry);
  }
  if (driver.passport_expiry) {
    await createReminderFromDriver(driverId, `Паспорт: ${driver.first_name} ${driver.last_name}`, driver.passport_expiry);
  }
  if (driver.license_expiry) {
    await createReminderFromDriver(driverId, `Права: ${driver.first_name} ${driver.last_name}`, driver.license_expiry);
  }
  if (driver.tachograph_card_expiry) {
    await createReminderFromDriver(driverId, `Карта тахографа: ${driver.first_name} ${driver.last_name}`, driver.tachograph_card_expiry);
  }

  return (
    <main style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px' }}>Карточка водителя</h1>
        <a href="/drivers" style={{ color: '#0070f3' }}>← Все водители</a>
      </div>

      <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '8px', marginTop: '15px' }}>
        <p><strong>Имя:</strong> {driver.first_name}</p>
        <p><strong>Фамилия:</strong> {driver.last_name}</p>
        <p><strong>Телефон:</strong> {driver.phone || '-'}</p>
        <p><strong>Срок визы:</strong> {driver.visa_expiry || '-'}</p>
        <p><strong>Срок паспорта:</strong> {driver.passport_expiry || '-'}</p>
        <p><strong>Срок прав:</strong> {driver.license_expiry || '-'}</p>
        <p><strong>Срок карты тахографа:</strong> {driver.tachograph_card_expiry || '-'}</p>
      </div>

      <div style={{ marginTop: '25px' }}>
        <form action={async () => {
          'use server';
          await sendDriverNotification(driverId, `${driver.first_name} ${driver.last_name}`, driver.visa_expiry || 'Срок не указан');
        }}>
          <button type="submit" style={{ padding: '10px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            📲 Сдать уведомление
          </button>
        </form>
      </div>

      <div style={{ marginTop: '25px' }}>
        <a href="/reminders" style={{ color: '#0070f3', textDecoration: 'underline' }}>
          → Список напоминаний
        </a>
      </div>
    </main>
  );
}
