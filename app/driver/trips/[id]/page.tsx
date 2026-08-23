import { supabase } from '../../../../lib/supabaseClient';
import { addExpense } from '../../../trip-actions';
import { deleteExpense } from '../../../expense-actions';
import { uploadDocument } from '../../upload-actions';

export default async function DriverTripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  
  if (!tripId) {
    return <div>Ошибка: ID рейса не передан</div>;
  }

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*, clients(name)')
    .eq('id', tripId)
    .single();

  const { data: expenses, error: expError } = await supabase
    .from('trip_expenses')
    .select('*')
    .eq('trip_id', tripId);

  if (tripError || expError) {
    return <div>Ошибка загрузки: {tripError?.message || expError?.message}</div>;
  }

  const totalExpenses = expenses?.reduce((sum,
