'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { logout } from '../login/actions';

const adminNavItems = [
  { href: '/', label: 'Главная', icon: '🏠' },
  { href: '/trips', label: 'Рейсы', icon: '📋' },
  { href: '/drivers', label: 'Водители', icon: '🚛' },
  { href: '/trucks', label: 'Транспорт', icon: '🚚' },
  { href: '/clients', label: 'Клиенты', icon: '🤝' },
  { href: '/contractors', label: 'Подрядчики', icon: '🏢' },
  { href: '/forwarding', label: 'Экспедирование', icon: '📦' },
  { href: '/locations', label: 'Локации', icon: '📍' },
  { href: '/routes', label: 'Маршруты', icon: '🛣' },
  { href: '/statistics', label: 'Статистика', icon: '📊' },
  { href: '/reports', label: 'Отчёты', icon: '💰' },
  { href: '/reminders', label: 'Напоминания', icon: '⏰' },
  { href: '/map', label: 'Карта', icon: '🗺' },
  { href: '/fixed-costs', label: 'Общие расходы', icon: '💶' },
  { href: '/audit', label: 'Аудит', icon: '📜' },
];

const driverNavItems = [
  { href: '/driver', label: 'Мои рейсы', icon: '🚚' },
  { href: '/driver/reminders', label: 'Напоминания', icon: '⏰' },
];

type Props = {
  role: string | null;
  userName: string;
};

export default function NavbarClient({ role, userName }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [searchValue, setSearchValue] = useState(searchParams.get('q') ?? '');

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      router.push('/login');
      router.refresh();
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchValue.trim();
    if (q.length < 2) return;
    setMenuOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  if (!role) return null;

  const navItems = role === 'driver' ? driverNavItems : adminNavItems;
  const displayName = userName || (role === 'admin' ? 'Офис' : 'Водитель');
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const isAdmin = role === 'admin';

  function isActive(href: string): boolean {
    if (href === '/' || href === '/driver') return pathname === href;
    return pathname === href || pathname.startsWith(href);
  }

  return (
    <>
      <nav className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 shadow-lg">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 flex items-center gap-4 md:gap-6">

          <Link
            href={role === 'driver' ? '/driver' : '/'}
            className="flex items-center gap-2 shrink-0"
          >
            <span className="text-2xl">🚛</span>
            <span className="text-white font-bold text-lg hidden sm:inline">Logistics CRM</span>
          </Link>

          <div className="hidden md:flex items-center gap-1 flex-wrap flex-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
                  ${isActive(item.href)
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3 ml-auto shrink-0">
            {isAdmin && (
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Поиск…"
                  className="w-48 lg:w-64 rounded-lg bg-slate-800 border border-slate-700 text-slate-100
                             placeholder:text-slate-500 pl-9 pr-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  aria-label="Глобальный поиск"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
              </form>
            )}

            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs">
                {initials}
              </div>
              <span className="text-slate-300 text-sm font-medium">{displayName}</span>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all duration-150 border border-red-500/30 disabled:opacity-60"
            >
              <span>🚪</span>
              <span>{isLoggingOut ? 'Выход…' : 'Выйти'}</span>
            </button>
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden ml-auto p-2 rounded-lg text-slate-200 hover:bg-slate-800 transition-all"
            aria-label="Меню"
          >
            <span className="text-2xl">{menuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </nav>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMenuOpen(false)}
          />

          <div className="fixed top-0 right-0 h-full w-[280px] bg-slate-900 z-50 md:hidden shadow-2xl overflow-y-auto">
            <div className="p-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-base">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="text-white font-semibold truncate">{displayName}</div>
                  <div className="text-slate-400 text-xs">
                    {role === 'driver' ? 'Водитель' : 'Офис'}
                  </div>
                </div>
              </div>

              {isAdmin && (
                <form onSubmit={handleSearchSubmit} className="mt-4 relative">
                  <input
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder="Поиск…"
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 text-slate-100
                               placeholder:text-slate-500 pl-9 pr-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    aria-label="Глобальный поиск"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
                </form>
              )}
            </div>

            <div className="p-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all
                    ${isActive(item.href)
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-200 hover:bg-slate-800'}`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>

            <div className="p-3 border-t border-slate-800 mt-2">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-500/30 disabled:opacity-60"
              >
                <span className="text-xl">🚪</span>
                <span>{isLoggingOut ? 'Выход…' : 'Выйти'}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
