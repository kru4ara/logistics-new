import { supabase } from '../../../lib/supabaseClient';
import { redirect } from 'next/navigation';

async function createDriver(formData: FormData) {
  'use server';

  const firstName = formData.get('first_name') as string;
  const lastName = formData.get('last_name') as string;
  const phone = formData.get('phone') as string;
  const visaExpiry = formData.get('visa_expiry') as string;
  const passportExpiry = formData.get('passport_expiry') as string;
  const licenseExpiry = formData.get('license_expiry') as string;
  const tachographCardExpiry = formData.get('tachograph_card_expiry') as string;

  const { error } = await supabase
    .from('drivers')
    .insert([
      {
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        visa_expiry: visaExpiry || null,
        passport_expiry: passportExpiry || null,
        license_expiry: licenseExpiry || null,
        tachograph_card_expiry: tachographCardExpiry || null
      }
    ]);

  if (error) {
    throw new Error(`Ошибка добавления: ${error.message}`);
  }

  redirect('/drivers');
}

export default function NewDriverPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px' }}>
      <h1 style={{ fontSize: '24px' }}>Добавить водителя</h1>
      
      <form action={createDriver} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        <div>
          <label htmlFor="first_name" style={{ display: 'block', fontWeight: 'bold' }}>Имя</label>
          <input 
            type="text" 
            id="first_name" 
            name="first_name" 
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label htmlFor="last_name" style={{ display: 'block', fontWeight: 'bold' }}>Фамилия</label>
          <input 
            type="text" 
            id="last_name" 
            name="last_name" 
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label htmlFor="phone" style={{ display: 'block', fontWeight: 'bold' }}>Телефон</label>
          <input 
            type="text" 
            id="phone" 
            name="phone" 
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label htmlFor="visa_expiry" style={{ display: 'block', fontWeight: 'bold' }}>Срок визы</label>
          <input 
            type="date" 
            id="visa_expiry" 
            name="visa_expiry" 
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label htmlFor="passport_expiry" style={{ display: 'block', fontWeight: 'bold' }}>Срок паспорта</label>
          <input 
            type="date" 
            id="passport_expiry" 
            name="passport_expiry" 
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label htmlFor="license_expiry" style={{ display: 'block', fontWeight: 'bold' }}>Срок прав</label>
          <input 
            type="date" 
            id="license_expiry" 
            name="license_expiry" 
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label htmlFor="tachograph_card_expiry" style={{ display: 'block', fontWeight: 'bold' }}>Срок карты тахографа</label>
          <input 
            type="date" 
            id="tachograph_card_expiry" 
            name="tachograph_card_expiry" 
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <button 
          type="submit" 
          style={{ 
            marginTop: '10px', 
            padding: '10px', 
            backgroundColor: '#0070f3', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Сохранить водителя
        </button>

        <a href="/drivers" style={{ marginTop: '10px', color: '#0070f3', textDecoration: 'underline' }}>
          ← Назад к списку
        </a>
      </form>
    </div>
  );
}
