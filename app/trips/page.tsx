import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function TripsPage() {
  const role = cookies().get('role')?.value;

  // Если водитель — уводим его в его раздел
  if (role === 'driver') {
    redirect('/driver');
  }

  // ... остальной код (загрузка рейсов)
}
