import { supabase } from '../../../lib/supabaseClient';
import { redirect } from 'next/navigation';

async function createClient(formData: FormData) {
  'use server';
  const name = formData.get('name') as string;
  const contact_person = formData.get('contact_person') as string;
  const phone = formData.get('phone') as string;
  const email = formData.get('email') as string;

  const { error } = await supabase.from('clients').insert([{ name, contact_person, phone, email }]);
  if (error) throw new Error(`Ошибка: ${error.message}`);
  redirect('/clients');
}

export default function NewClientPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px' }}>
      <h1>Новый клиент</h1>
      <form action={createClient} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input type="text" name="name" placeholder="Название" required style={{ padding: '8px' }} />
        <input type="text" name="contact_person" placeholder="Контактное лицо" style={{ padding: '8px' }} />
        <input type="text" name="phone" placeholder="Телефон" style={{ padding: '8px' }} />
        <input type="email" name="email" placeholder="Email" style={{ padding: '8px' }} />
        <button type="submit" style={{ padding: '10px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px' }}>Сохранить</button>
        <a href="/clients" style={{ color: '#0070f3' }}>← Назад</a>
      </form>
    </div>
  );
}