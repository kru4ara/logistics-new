import { supabase } from '../../../lib/supabaseClient';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { useRouter } from 'next/navigation';

export default function NewClientPage() {
  const router = useRouter();
  
  async function createClient(formData: FormData) {
    'use server';
    const name = formData.get('name') as string;
    const contactPerson = formData.get('contact_person') as string;
    const phone = formData.get('phone') as string;
    const email = formData.get('email') as string;
    const { error } = await supabase.from('clients').insert([
      {
        name: name,
        contact_person: contactPerson || null,
        phone: phone || null,
        email: email || null
      }
    ]);
    if (error) {
      throw new Error(`Ошибка добавления: ${error.message}`);
    }
    revalidatePath('/clients');
    redirect('/clients');
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px' }}>
      <h1 style={{ fontSize: '24px' }}>Добавить клиента</h1>
      <form action={createClient} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        <div>
          <label htmlFor="name" style={{ display: 'block', fontWeight: 'bold' }}>Название компании</label>
          <input 
            type="text" 
            id="name" 
            name="name" 
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>
        <div>
          <label htmlFor="contact_person" style={{ display: 'block', fontWeight: 'bold' }}>Контактное лицо</label>
          <input 
            type="text" 
            id="contact_person" 
            name="contact_person" 
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
          <label htmlFor="email" style={{ display: 'block', fontWeight: 'bold' }}>Email</label>
          <input 
            type="email" 
            id="email" 
            name="email" 
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
          Сохранить клиента
        </button>
        <a href="/clients" style={{ marginTop: '10px', color: '#0070f3', textDecoration: 'underline' }}>
          ← Назад к списку
        </a>
      </form>
    </div>
  );
}
