import { supabase } from '../../../../lib/supabaseClient';
import { updateDriver } from '../../../driver-actions';

export default async function EditDriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: driverId } = await params;
  const { data: driver, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driverId)
    .single();

  if (error) return <div>Ошибка загрузки: {error.message}</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px' }}>
      <h1 style={{ fontSize: '24px' }}>Редактировать водителя</h1>
      <form action={updateDriver.bind(null, driverId)} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        <div>
          <label>Имя</label>
          <input type="text" name="first_name" defaultValue={driver.first_name || ''} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Фамилия</label>
          <input type="text" name="last_name" defaultValue={driver.last_name || ''} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Телефон</label>
          <input type="text" name="phone" defaultValue={driver.phone || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Номер паспорта</label>
          <input type="text" name="passport_number" defaultValue={driver.passport_number || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Срок паспорта</label>
          <input type="date" name="passport_expiry" defaultValue={driver.passport_expiry || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Срок визы</label>
          <input type="date" name="visa_expiry" defaultValue={driver.visa_expiry || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Номер прав</label>
          <input type="text" name="license_number" defaultValue={driver.license_number || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Срок прав</label>
          <input type="date" name="license_expiry" defaultValue={driver.license_expiry || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Номер карты тахографа</label>
          <input type="text" name="tachograph_card_number" defaultValue={driver.tachograph_card_number || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Срок карты тахографа</label>
          <input type="date" name="tachograph_card_expiry" defaultValue={driver.tachograph_card_expiry || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Срок Код 95</label>
          <input type="date" name="code_95_expiry" defaultValue={driver.code_95_expiry || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Срок АДР</label>
          <input type="date" name="adr_expiry" defaultValue={driver.adr_expiry || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Дата рождения</label>
          <input type="date" name="date_of_birth" defaultValue={driver.date_of_birth || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Адрес</label>
          <input type="text" name="address" defaultValue={driver.address || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <button type="submit" style={{ padding: '10px', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Сохранить</button>
        <a href={`/drivers/${driverId}`} style={{ color: '#0070f3' }}>← Назад к карточке</a>
      </form>
    </div>
  );
}
