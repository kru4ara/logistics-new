'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const adminNavItems = [
  { href: '/', label: '🚛 Главная' },
  { href: '/trips', label: '📋 Рейсы' },
  { href: '/drivers', label: '🚛 Водители' },
  { href: '/trucks', label: '🚚 Машины' },
  { href: '/clients', label: '🤝 Клиенты' },
  { href: '/routes', label: '🛣 Маршруты' },
  { href: '/reports', label: '💰 Отчёты' },
  { href: '/reminders', label: '⏰ Напоминания' },
  { href: '/map', label: '🗺 Карта' },
  { href: '/fixed-costs', label: '💶 Фикс. затраты' },
];

const driverNavItems = [
  { href: '/driver', label: '🚚 Мои рейсы' },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    // Читаем cookie role
    const cookies = document.cookie.split('; ');
    const roleCookie = cookies.find((c) => c.startsWith('role='));
    if (roleCookie) {
      setRole(roleCookie.split('=')[1]);
    }
  }, [pathname]);

  function handleLogout() {
    document.cookie = 'role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'driver_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  }

  // Пока роль не определена (не залогинен) — ничего не показываем
  if (!role) return null;

  const navItems = role === 'driver' ? driverNavItems : adminNavItems;

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 24px',
        backgroundColor: '#1e293b',
        color: 'white',
        flexWrap: 'wrap',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== '/' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              textDecoration: 'none',
              color: 'white',
              backgroundColor: isActive ? '#3b82f6' : 'transparent',
              fontWeight: isActive ? 'bold' : 'normal',
              transition: 'background-color 0.2s',
            }}
          >
            {item.label}
          </Link>
        );
      })}

      <div style={{ marginLeft: 'auto' }}>
        <button
          onClick={handleLogout}
          style={{
            padding: '8px 16px',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Выйти
        </button>
      </div>
    </nav>
  );
}
