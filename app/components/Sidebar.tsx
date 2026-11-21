'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { can, isDriverRole, isManagerRole, isOfficeRole, capabilityForPath } from '../../lib/roles';
import type { MessageKey } from '../../lib/i18n/translate';
import { useT } from './I18nProvider';
import LanguageSwitcher from './LanguageSwitcher';
import { useEffect, useState } from 'react';
import {
  Package,
  Route,
  Map,
  Users,
  UserCircle,
  Truck,
  Briefcase,
  Building2,
  MapPin,
  BarChart3,
  Wallet,
  Banknote,
  ScrollText,
  Bell,
  LogOut,
  Pin,
  PinOff,
  X,
  Home,
  Calendar,
  RadioTower,
  HandCoins, ReceiptText, Landmark, Coins,
  type LucideIcon,
  Settings, ShieldCheck } from 'lucide-react';
import { logout } from '../login/actions';

// Подписи — ключи перевода (lib/i18n/messages), не текст.
type NavItem = {
  href: string;
  labelKey: MessageKey;
  icon: LucideIcon;
};

type NavSection = {
  titleKey: MessageKey;
  items: NavItem[];
};

const adminSections: NavSection[] = [
  {
    titleKey: 'nav.sectionWork',
    items: [
      { href: '/trips', labelKey: 'nav.trips', icon: Package },
      { href: '/routes', labelKey: 'nav.routes', icon: Route },
      { href: '/map', labelKey: 'nav.map', icon: Map },
    ],
  },
  {
    titleKey: 'nav.sectionDirectory',
    items: [
      { href: '/clients', labelKey: 'nav.clients', icon: Users },
      { href: '/drivers', labelKey: 'nav.drivers', icon: UserCircle },
      { href: '/managers', labelKey: 'nav.managers', icon: Briefcase },
      { href: '/trucks', labelKey: 'nav.trucks', icon: Truck },
      { href: '/contractors', labelKey: 'nav.contractors', icon: Building2 },
      { href: '/locations', labelKey: 'nav.locations', icon: MapPin },
    ],
  },
  {
    titleKey: 'nav.sectionAnalytics',
    items: [
      { href: '/statistics', labelKey: 'nav.statistics', icon: BarChart3 },
      { href: '/reports', labelKey: 'nav.reports', icon: Wallet },
      { href: '/receivables', labelKey: 'nav.receivables', icon: HandCoins },
      { href: '/payables', labelKey: 'nav.payables', icon: ReceiptText },
      { href: '/bank', labelKey: 'bank.nav', icon: Landmark },
      { href: '/fixed-costs', labelKey: 'nav.fixedCosts', icon: Banknote },
      { href: '/income', labelKey: 'income.nav', icon: Coins },
      { href: '/audit', labelKey: 'nav.audit', icon: ScrollText },
      { href: '/settings', labelKey: 'nav.settings', icon: Settings },
    ],
  },
];

const driverSections: NavSection[] = [
  {
    titleKey: 'nav.sectionMine',
    items: [
      { href: '/driver', labelKey: 'nav.myTrips', icon: Package },
      { href: '/driver/logisat', labelKey: 'nav.logisatFuel', icon: RadioTower },
      { href: '/driver/stats', labelKey: 'nav.myStats', icon: BarChart3 },
      { href: '/driver/balance', labelKey: 'nav.myBalance', icon: HandCoins },
    ],
  },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/' || href === '/driver' || href === '/today') return pathname === href;
  return pathname === href || pathname.startsWith(href);
}

function SidebarContent({
  role,
  isAdmin,
  userName,
  isExpanded,
  mobile,
  pathname,
  isPinned,
  onTogglePin,
}: {
  role: string | null;
  isAdmin: boolean;
  userName: string;
  isExpanded: boolean;
  mobile: boolean;
  pathname: string;
  isPinned: boolean;
  onTogglePin: () => void;
}) {
  const expanded = mobile || isExpanded;
  const sections = isDriverRole(role) ? driverSections : adminSections;
  const { t } = useT();
  const roleText = isDriverRole(role)
    ? t('nav.roleDriver')
    : isManagerRole(role)
      ? t('nav.roleManager')
      : isOfficeRole(role)
        ? t('nav.roleOffice')
        : t('nav.roleAccountant');
  const displayName = userName || roleText;
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const router = useRouter();

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // logout() сам делает redirect('/login'). Сюда попадаем, если redirect
      // не сработал (например, сессия уже истекла) — уходим через роутер.
      router.replace('/login');
    }
  }

  const remindersHref = isDriverRole(role) ? '/driver/reminders' : '/reminders';

  return (
    <div className="flex flex-col h-full">
      <Link
        href={isDriverRole(role) ? '/driver' : '/'}
        className={`flex items-center gap-3 px-4 h-14 shrink-0 border-b border-white/5
                   hover:bg-white/5 transition-colors ${expanded ? '' : 'justify-center px-0'}`}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center shrink-0 shadow-brand">
          <Truck className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        {expanded && (
          <span className="text-white font-bold text-base tracking-tight whitespace-nowrap">
            Logistics CRM
          </span>
        )}
      </Link>

      <div className="flex-1 overflow-y-auto scrollbar-thin py-3">
        {isAdmin && (
          <div className="px-2 mb-2 space-y-0.5">
            <Link
              href="/"
              className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150
                ${expanded ? 'px-3 py-2' : 'justify-center px-0 py-2 w-10 mx-auto'}
                ${isActivePath(pathname, '/')
                  ? 'bg-brand-600 text-white shadow-brand'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
              title={expanded ? undefined : t('nav.home')}
            >
              <Home className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
              {expanded && <span className="whitespace-nowrap">{t('nav.home')}</span>}
            </Link>
            <Link
              href="/today"
              className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150
                ${expanded ? 'px-3 py-2' : 'justify-center px-0 py-2 w-10 mx-auto'}
                ${isActivePath(pathname, '/today')
                  ? 'bg-brand-600 text-white shadow-brand'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
              title={expanded ? undefined : t('nav.today')}
            >
              <Calendar className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
              {expanded && <span className="whitespace-nowrap">{t('nav.today')}</span>}
            </Link>
          </div>
        )}

        {sections.map((section) => (
          <div key={section.titleKey} className="mt-4">
            {expanded ? (
              <div className="px-5 mb-1.5 text-[10px] uppercase tracking-[0.1em] text-slate-500 font-semibold">
                {t(section.titleKey)}
              </div>
            ) : (
              <div className="mx-3 my-2 h-px bg-white/5" />
            )}

            <div className="px-2 space-y-0.5">
              {section.items
                .filter((item) => {
                  // Пункт показывается, только если у роли есть право
                  // на этот путь. Для менеджера так автоматически
                  // исчезают «Аудит» (нет audit.view) и «Менеджеры»
                  // (нет managers.view), а у водителя — всё, кроме
                  // его разделов.
                  const cap = capabilityForPath(item.href);
                  if (!cap) return true;
                  return can(role, cap);
                })
                .map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={expanded ? undefined : t(item.labelKey)}
                    className={`relative flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150
                      ${expanded ? 'px-3 py-2' : 'justify-center px-0 py-2 w-10 mx-auto'}
                      ${active
                        ? 'bg-brand-600 text-white shadow-brand'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
                  >
                    {active && !expanded && (
                      <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-brand-500" />
                    )}
                    <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
                    {expanded && <span className="whitespace-nowrap">{t(item.labelKey)}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div className="mt-4 pt-4 border-t border-white/5 px-2">
          <Link
            href={remindersHref}
            title={expanded ? undefined : t('nav.reminders')}
            className={`relative flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150
              ${expanded ? 'px-3 py-2' : 'justify-center px-0 py-2 w-10 mx-auto'}
              ${isActivePath(pathname, remindersHref)
                ? 'bg-brand-600 text-white shadow-brand'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
          >
            <Bell className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
            {expanded && <span className="whitespace-nowrap">{t('nav.reminders')}</span>}
          </Link>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/5 p-2 space-y-1">
        <div
          className={`flex items-center gap-3 rounded-lg py-2 transition-all
            ${expanded ? 'px-3' : 'justify-center px-0'}`}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-brand">
            {initials}
          </div>
          {expanded && (
            <div className="min-w-0 flex-1">
              <div className="text-white text-sm font-semibold truncate">{displayName}</div>
              <div className="text-slate-500 text-[10px] uppercase tracking-wide">
                {roleText}
              </div>
            </div>
          )}
        </div>

        {expanded && (
          <div className="px-3 py-1">
            <LanguageSwitcher tone="dark" />
          </div>
        )}

        <Link
          href="/account/security"
          title={t('mfa.link')}
          className={`w-full flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-all text-slate-400 hover:bg-white/5 hover:text-white
            ${expanded ? 'px-3' : 'justify-center px-0'}`}
        >
          <ShieldCheck className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
          {expanded && <span className="whitespace-nowrap">{t('mfa.link')}</span>}
        </Link>

        {!mobile && (
          <button
            type="button"
            onClick={onTogglePin}
            title={isPinned ? t('nav.unpinPanel') : t('nav.pinPanel')}
            className={`w-full flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-all
              ${expanded ? 'px-3' : 'justify-center px-0'}
              ${isPinned ? 'text-brand-300 bg-brand-500/10 hover:bg-brand-500/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
          >
            {isPinned
              ? <PinOff className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
              : <Pin className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />}
            {expanded && <span className="whitespace-nowrap">{isPinned ? t('nav.unpin') : t('nav.pin')}</span>}
          </button>
        )}

        <button
          type="button"
          onClick={handleLogout}
          title={expanded ? undefined : t('nav.logout')}
          className={`w-full flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-all
            text-red-400 hover:bg-red-500/10 hover:text-red-300
            ${expanded ? 'px-3' : 'justify-center px-0'}`}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
          {expanded && <span className="whitespace-nowrap">{t('nav.logout')}</span>}
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({
  role,
  userName,
  mobileOpen,
  onMobileClose,
  isPinned,
  onTogglePin,
}: {
  role: string | null;
  userName: string;
  mobileOpen: boolean;
  onMobileClose: () => void;
  isPinned: boolean;
  onTogglePin: () => void;
}) {
  const { t } = useT();
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  useEffect(() => {
    onMobileClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!role) return null;

  const isAdmin = can(role, 'trips.viewAll');
  const isExpanded = isPinned || isHovered;

  return (
    <>
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`hidden md:flex fixed top-0 left-0 h-screen z-40 flex-col
                    bg-ink-900 border-r border-white/5
                    transition-[width] duration-200 ease-smooth
                    ${isExpanded ? 'w-60' : 'w-16'}
                    ${isHovered && !isPinned ? 'shadow-2xl shadow-ink-950/40' : 'shadow-lg shadow-ink-900/10'}`}
      >
        <SidebarContent
          role={role}
          isAdmin={isAdmin}
          userName={userName}
          isExpanded={isExpanded}
          mobile={false}
          pathname={pathname}
          isPinned={isPinned}
          onTogglePin={onTogglePin}
        />
      </aside>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm z-40 md:hidden animate-fade-in"
            onClick={onMobileClose}
          />
          <aside
            className="fixed top-0 left-0 h-screen w-72 z-50 flex flex-col
                       bg-ink-900 border-r border-white/5 shadow-2xl md:hidden
                       animate-slide-up"
          >
            <button
              type="button"
              onClick={onMobileClose}
              className="absolute top-3 right-3 w-9 h-9 rounded-lg flex items-center justify-center
                         text-slate-400 hover:text-white hover:bg-white/5 transition-colors z-10"
              aria-label={t('nav.closeMenu')}
            >
              <X className="w-5 h-5" strokeWidth={2} />
            </button>
            <SidebarContent
              role={role}
              isAdmin={isAdmin}
              userName={userName}
              isExpanded={isExpanded}
              mobile
              pathname={pathname}
              isPinned={isPinned}
              onTogglePin={onTogglePin}
            />
          </aside>
        </>
      )}
    </>
  );
}
