'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    
    // Логируем каждый шаг в консоль браузера
    console.log('1. handleLogin вызвана');
    console.log('2. Email:', email, '| Password:', password);

    if (!email || !password) {
      console.log('3. Поля пустые');
      alert('Введите email и пароль');
      return;
    }

    try {
      console.log('4. Пробуем войти через Supabase...');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      console.log('5. Ответ от Supabase:', data, error);

      if (error) {
        alert('Ошибка входа: ' + error.message);
        return;
      }

      console.log('6. Успех! Перенаправляем на главную...');
      router.push('/');
    } catch (err) {
      console.error('7. Поймали ошибку:', err);
      alert('Ошибка: ' + (err as Error).message);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center">🔐 Вход в систему</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              placeholder="Введите email"
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
              placeholder="Введите пароль"
              required
            />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">
            Войти
          </button>
        </form>
      </div>
    </main>
  );
}
