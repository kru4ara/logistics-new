import { supabase } from '../../../lib/supabaseClient';
import { redirect } from 'next/navigation';

async function createFixedCost(formData: FormData) {
  'use server';

  const monthKey = formData.get('month_key') as string;
  const category = formData.get('category') as string;
  const amountPln = parseFloat(formData.get('amount_pln') as string) || 0;
  const amountEur = parseFloat(formData.get('amount_eur') as string) || 0;

  const { error } = await supabase
    .from('fixed_costs')
    .insert([
      {
        month_key: monthKey,
        category: category,
        amount_pln: amountPln,
        amount_eur: amountEur
      }
    ]);

  if (error) {
    throw new Error(`Ошибка добавления: ${error.message}`);
  }

  redirect('/fixed-costs');
}

export default function NewFixedCostPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px' }}>
      <h1 style={{ fontSize: '24px' }}>Добавить фиксированную затрату</h1>
      
      <form action={createFixedCost} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        <div>
          <label htmlFor="month_key" style={{ display: 'block', fontWeight: 'bold' }}>Месяц (ГГГГ-ММ)</label>
          <input 
            type="month" 
            id="month_key" 
            name="month_key" 
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label htmlFor="category" style={{ display: 'block', fontWeight: 'bold' }}>Категория</label>
          <input 
            type="text" 
            id="category" 
            name="category" 
            placeholder="Например: Страховка, Бухгалтерия"
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label htmlFor="amount_pln" style={{ display: 'block', fontWeight: 'bold' }}>Сумма (PLN)</label>
          <input 
            type="number" 
            id="amount_pln" 
            name="amount_pln" 
            step="0.01"
            placeholder="0.00"
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label htmlFor="amount_eur" style={{ display: 'block', fontWeight: 'bold' }}>Сумма (EUR)</label>
          <input 
            type="number" 
            id="amount_eur" 
            name="amount_eur" 
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
          Сохранить затрату
        </button>

        <a href="/fixed-costs" style={{ marginTop: '10px', color: '#0070f3', textDecoration: 'underline' }}>
          ← Назад к списку
        </a>
      </form>
    </div>
  );
}
