import { supabase } from '../../../../lib/supabaseClient';
import { updateTruck } from '../../../truck-actions';

export default async function EditTruckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: truckId } = await params;
  const { data: truck, error } = await supabase
    .from('trucks')
    .select('*')
    .eq('id', truckId)
    .single();

  if (error) return <div>Ошибка загрузки: {error.message}</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px' }}>
      <h1 style={{ fontSize: '24px' }}>Редактировать машину</h1>
      <form action={updateTruck.bind(null, truckId)} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        <div>
          <label>Госномер</label>
          <input type="text" name="registration_number" defaultValue={truck.registration_number || ''} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Тип</label>
          <select name="type" defaultValue={truck.type || ''} style={{ width: '100%', padding: '8px' }}>
            <option value="tractor">Тягач</option>
            <option value="trailer">Прицеп</option>
          </select>
        </div>
        <div>
          <label>Номер прицепа</label>
          <input type="text" name="trailer_number" defaultValue={truck.trailer_number || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Страховка ОС до</label>
          <input type="date" name="truck_insurance_expiry" defaultValue={truck.truck_insurance_expiry || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Пограничная страховка до</label>
          <input type="date" name="border_insurance_expiry" defaultValue={truck.border_insurance_expiry || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Техосмотр до</label>
          <input type="date" name="tech_inspection_expiry" defaultValue={truck.tech_inspection_expiry || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Топливная карта</label>
          <input type="text" name="fuel_card_number" defaultValue={truck.fuel_card_number || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Легализация тахографа до</label>
          <input type="date" name="tachograph_legalization_expiry" defaultValue={truck.tachograph_legalization_expiry || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <button type="submit" style={{ padding: '10px', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Сохранить</button>
        <a href={`/trucks/${truckId}`} style={{ color: '#0070f3' }}>← Назад к карточке</a>
      </form>
    </div>
  );
}
