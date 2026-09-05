import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default function Home() {
  const cookieStore = cookies();
  const role = cookieStore.get('role')?.value;

  if (role === 'driver') {
    redirect('/driver');
  }

  if (!role || role !== 'admin') {
    redirect('/login');
  }

  // Здесь офисная панель (оставь свою текущую, просто убери проверки supabase.auth)
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold">Панель управления (Офис)</h1>
      {/* Твои кнопки и цифры */}
    </main>
  );
}
