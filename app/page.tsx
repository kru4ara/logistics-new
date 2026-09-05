import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function Home() {
  const role = await getRole();
  if (!role) redirect('/login');
  if (role === 'driver') redirect('/driver');

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Панель управления (Офис)</h1>
        <div className="flex flex-wrap gap-4">
          <Button asChild><a href="/trips">📋 Рейсы</a></Button>
          <Button asChild><a href="/drivers">🚛 Водители</a></Button>
          <Button asChild><a href="/trucks">🚚 Машины</a></Button>
          <Button asChild><a href="/clients">🤝 Клиенты</a></Button>
        </div>
      </div>
    </main>
  );
}

async function getRole() {
  // Функция для чтения роли из cookie или localStorage (в серверном компоненте используем cookies)
  return 'admin'; // Временно ставим admin для проверки, потом заменим
}
