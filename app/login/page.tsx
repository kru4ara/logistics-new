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
      document.cookie = 'user_name=' + encodeURIComponent('Офис') + '; path=/';
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
      document.cookie = 'user_name=' + encodeURIComponent(driver.first_name + ' ' + driver.last_name) + '; path=/';
      router.push('/driver');
      return;
    }

    setError('Неверный логин или пароль');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔐</div>
          <h1 className="text-2xl font-bold text-slate-900">Вход в систему</h1>
          <p className="text-sm text-slate-500 mt-1">Logistics CRM</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Логин</label>
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="office или фамилия"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-all duration-150"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-all duration-150"
              required
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg
                       transition-all duration-150 shadow-md shadow-blue-600/20 active:scale-[0.98]"
          >
            Войти
          </button>
        </form>
      </div>
    </main>
  );
}
