import { supabase } from '../../../lib/supabaseClient';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

async function createReminder(formData: FormData) {
  'use server';

  const title = formData.get('title') as string;
  const category = formData.get('category') as string;
  const dueDate = formData.get('due_date') as string;
  const amount = parseFloat(formData.get('amount') as string) || 0;

  const { error } = await supabase
    .from('reminders')
    .insert([
      {
        title: title,
        category: category,
        due_date: dueDate,
        amount: amount,
        status: 'active'
      }
    ]);

  if (error) {
    throw new Error(`Ошибка добавления: ${error.message}`);
  }

  revalidatePath('/reminders');
  redirect('/reminders');
}

export default function NewReminderPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px' }}>
      <h1 style={{ fontSize: '24px' }}>Добавить напоминание</h1>
      
      <form action={createReminder} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        <div>
          <label htmlFor="title" style={{ display: 'block', fontWeight: 'bold' }}>Напоминание</label>
          <input 
            type="text" 
            id="title" 
            name="title" 
            placeholder="Например: Страховка DAF"
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label htmlFor="category" style={{ display: 'block', fontWeight: 'bold' }}>Категория</label>
          <select 
            id="category" 
            name="category" 
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="insurance">Страховка</option>
            <option value="inspection">Техосмотр</option>
            <option value="driver_doc">Документы водителя</option>
            <option value="payment_to_contractor">Подрядчик</option>
            <option value="accounting">Бухгалтерия</option>
          </select>
        </div>

        <div>
          <label htmlFor="due_date" style={{ display: 'block', fontWeight: 'bold' }}>Дата</label>
          <input 
            type="date" 
            id="due_date" 
            name="due_date" 
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label htmlFor="amount" style={{ display: 'block', fontWeight: 'bold' }}>Сумма (€)</label>
          <input 
            type="number" 
            id="amount" 
            name="amount" 
            step="0.01"
            placeholder="0.00"
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
          Сохранить напоминание
        </button>

        <a href="/reminders" style={{ marginTop: '10px', color: '#0070f3', textDecoration: 'underline' }}>
          ← Назад к списку
        </a>
      </form>
    </div>
  );
}
