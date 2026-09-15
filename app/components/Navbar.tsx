'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const adminNavItems = [
  { href: '/', label: 'Главная', icon: '🏠' },
  { href: '/trips', label: 'Рейсы', icon: '📋' },
  { href: '/drivers', label: 'Водители', icon: '🚛' },
  { href: '/trucks', label: 'Транспорт', icon: '🚚' },
  { href: '/clients', label: 'Клиенты', icon: '🤝' },
  { href: '/routes', label: 'Маршруты', icon: '🛣' },
  { href: '/reports', label: 'Отчёты', icon: '💰' },
  { href: '/reminders', label: 'Напоминания', icon: '⏰' },
  { href: '/map', label: 'Карта', icon: '🗺' },
  { href: '/fixed-costs', label: 'Фикс. затраты', icon: '💶' },
];

const driverNavItems = [
  { href: '/driver', label: 'Мои рейсы', icon: '🚚' },
  { href: '/driver/reminders', label: 'Напоминания', icon: '⏰' },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    const cookies = document.cookie.split('; ');
    const roleCookie = cookies.find((c) => c.startsWith('role='));
    const nameCookie = cookies.find((c) => c.startsWith('user_name='));
    if (roleCookie) setRole(roleCookie.split('=')[1]);
    if (nameCookie) setUserName(decodeURIComponent(nameCookie.split('=')[1]));
  }, [pathname]);

  function handleLogout() {
    document.cookie = 'role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'driver_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'user_name=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  }

  if (!role) return null;

  const navItems = role === 'driver' ? driverNavItems : adminNavItems;
  const displayName = userName || (role === 'admin' ? 'Офис' : 'Водитель');
  const initials = displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <nav className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 shadow-lg">
      <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center gap-6 flex-wrap">
        <Link href={role === 'driver' ? '/driver' : '/'} className="flex items-center gap-2 shrink-0">
          <span className="text-2xl">🚛</span>
          <span className="text-white font-bold text-lg hidden sm:block">Logistics CRM</span>
        </Link>

        <div className="flex items-center gap-1 flex-wrap flex-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && item.href !== '/driver' && pathname.startsWith(item.href)) ||
              (item.href === '/driver' && pathname === '/driver');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
                  ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
              >
                <span>{item.icon}</span>
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3 ml-auto shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs">
              {initials}
            </div>
            <span className="text-slate-300 text-sm font-medium">{displayName}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all duration-150 border border-red-500/30"
          >
            <span>🚪</span>
            <span className="hidden sm:inline">Выйти</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
