import { supabase } from '../../../lib/supabaseClient';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

async function createFixedCost(formData: FormData) {
  'use server';

  const monthKey = formData.get('month_key') as string;
  const category = formData.get('category') as string;
  const amount = parseFloat(formData.get('amount') as string) || 0;
  const currency = formData.get('currency') as string;
  const amountEur = parseFloat(formData.get('amount_eur') as string) || 0;

  // Если валюта не EUR, автоматически пересчитываем
  let amountEurFinal = amountEur;
  if (currency === 'PLN') {
    const { data: rate } = await supabase
      .from('rates')
      .select('pln_to_eur')
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();

    if (rate?.pln_to_eur) {
      amountEurFinal = amount * rate.pln_to_eur;
    }
  } else if (currency === 'BYN') {
    const { data: rate } = await supabase
      .from('rates')
      .select('byn_to_eur')
      .order('rate_date', { ascending: false })
      .limit(1)
      .single();

    if (rate?.byn_to_eur) {
      amountEurFinal = amount * rate.byn_to_eur;
    }
  }

  const { error } = await supabase
    .from('fixed_costs')
    .insert([
      {
        month_key: monthKey,
        category: category,
        amount_pln: currency === 'PLN' ? amount : null,
        amount_eur: amountEurFinal,
        currency: currency
      }
    ]);

  if (error) {
    throw new Error(`Ошибка добавления: ${error.message}`);
  }

  revalidatePath('/fixed-costs');
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
          <label htmlFor="currency" style={{ display: 'block', fontWeight: 'bold' }}>Валюта</label>
          <select 
            id="currency" 
            name="currency" 
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="EUR">EUR</option>
            <option value="PLN">PLN</option>
            <option value="BYN">BYN</option>
          </select>
        </div>

        <div>
          <label htmlFor="amount" style={{ display: 'block', fontWeight: 'bold' }}>Сумма</label>
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
          Сохранить затрату
        </button>

        <a href="/fixed-costs" style={{ marginTop: '10px', color: '#0070f3', textDecoration: 'underline' }}>
          ← Назад к списку
        </a>
      </form>
    </div>
  );
}
