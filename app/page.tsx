import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default function Home() {
  const cookieStore = cookies();
  const role = cookieStore.get('role')?.value;

  // Если нет роли - на логин
  if (!role) {
    redirect('/login');
  }

  // Если роль водителя - в его раздел
  if (role === 'driver') {
    redirect('/driver');
  }

  // Если роль офиса - показываем панель
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Панель управления (Офис)</h1>
        {/* Здесь ты можешь вернуть свои кнопки и цифры */}
        <div className="flex flex-wrap gap-4">
          <a href="/trips" className="bg-blue-600 text-white px-4 py-2 rounded">📋 Рейсы</a>
          <a href="/drivers" className="bg-blue-600 text-white px-4 py-2 rounded">🚛 Водители</a>
          <a href="/trucks" className="bg-blue-600 text-white px-4 py-2 rounded">🚚 Машины</a>
          <a href="/clients" className="bg-blue-600 text-white px-4 py-2 rounded">🤝 Клиенты</a>
        </div>
      </div>
    </main>
  );
}
