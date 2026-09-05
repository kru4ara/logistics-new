'use client';

import { useEffect, useState } from 'react';
import { login } from './actions';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

  // Читаем ошибку из URL только на клиенте
  useEffect(() => {
    if (window.location.search.includes('error')) {
      setError('Неверный логин или пароль');
    }
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">🔐 Вход в систему</h1>
        <form action={login} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Логин</label>
            <input name="login" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Пароль</label>
            <input type="password" name="password" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" required />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">Войти</button>
        </form>
      </div>
    </main>
  );
}
