import { supabase } from '../../../lib/supabaseClient';
import { redirect } from 'next/navigation';

async function createTruck(formData: FormData) {
  'use server';

  const registration_number = formData.get('registration_number') as string;
  const type = formData.get('type') as string;
  const insurance_expiry = formData.get('insurance_expiry') as string;
  const tech_inspection_expiry = formData.get('tech_inspection_expiry') as string;

  const { error } = await supabase.from('trucks').insert([
    { registration_number, type, insurance_expiry, tech_inspection_expiry }
  ]);

  if (error) throw new Error(`Ошибка: ${error.message}`);
  redirect('/trucks');
}

export default function NewTruckPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px' }}>
      <h1>Добавить машину</h1>
      <form action={createTruck} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <label>Госномер</label>
          <input type="text" name="registration_number" required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Тип</label>
          <select name="type" required style={{ width: '100%', padding: '8px' }}>
            <option value="tractor">Тягач</option>
            <option value="trailer">Прицеп</option>
          </select>
        </div>
        <div>
          <label>Страховка до</label>
          <input type="date" name="insurance_expiry" style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Техосмотр до</label>
          <input type="date" name="tech_inspection_expiry" style={{ width: '100%', padding: '8px' }} />
        </div>
        <button type="submit" style={{ backgroundColor: '#0070f3', color: 'white', padding: '10px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Сохранить</button>
        <a href="/trucks" style={{ color: '#0070f3' }}>← Назад</a>
      </form>
    </div>
  );
}