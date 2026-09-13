'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // 1. Проверяем офис
    const { data: admin } = await supabase
      .from('users')
      .select('*')
      .eq('login', login)
      .eq('password', password)
      .maybeSingle();

    if (admin) {
      document.cookie = 'role=admin; path=/';
      router.push('/');
      return;
    }

    // 2. Проверяем водителя (регистр не важен)
    const { data: driver } = await supabase
      .from('drivers')
      .select('*')
      .ilike('last_name', login)
      .eq('password', password)
      .maybeSingle();

    if (driver) {
      document.cookie = 'role=driver; path=/';
      document.cookie = 'driver_id=' + driver.id + '; path=/';
      router.push('/driver');
      return;
    }

    setError('Неверный логин или пароль');
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">🔐 Вход в систему</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Логин</label>
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">
            Войти
          </button>
        </form>
      </div>
    </main>
  );
}
