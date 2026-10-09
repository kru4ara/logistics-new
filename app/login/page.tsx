import { RadioTower, Lock } from 'lucide-react';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex">
      {/* ЛЕВАЯ ЧАСТЬ: брендинг (только на десктопе) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-ink-900 via-ink-900 to-brand-800 overflow-hidden">
        {/* Декоративные круги */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-20 w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-3xl" />

        {/* Тонкая сетка на фоне */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 flex flex-col justify-between w-full p-12 xl:p-16 text-white">
          {/* Шапка с логотипом */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-8 h-8">
                <rect x="90" y="210" width="220" height="120" rx="12" fill="#0f172a" />
                <path d="M310 250 L372 250 L412 288 L412 330 L310 330 Z" fill="#0f172a" />
                <circle cx="155" cy="350" r="30" fill="#0f172a" />
                <circle cx="155" cy="350" r="13" fill="#fbbf24" />
                <circle cx="355" cy="350" r="30" fill="#0f172a" />
                <circle cx="355" cy="350" r="13" fill="#fbbf24" />
              </svg>
            </div>
            <div>
              <div className="text-xl font-bold tracking-wide">RAIBUILDING</div>
              <div className="text-xs text-amber-300/70 tracking-widest uppercase">
                Logistics CRM
              </div>
            </div>
          </div>

          {/* Центральный текст */}
          <div className="max-w-md">
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-4">
              Управляйте
              <br />
              <span className="text-amber-400">логистикой</span>
              <br />
              из одного окна
            </h1>
            <p className="text-slate-300 text-base xl:text-lg leading-relaxed">
              Рейсы, экспедирование, водители, документы — всё в одном месте.
              Синхронизация с Logisat, уведомления в Telegram, отчёты в Excel.
            </p>
          </div>

          {/* Футер с мелкими бейджами */}
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 bg-white/5 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Работает 24/7</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/5 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
              <RadioTower className="w-3 h-3" />
              <span>Logisat</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/5 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
              <Lock className="w-3 h-3" />
              <span>Защищено</span>
            </div>
          </div>
        </div>
      </div>

      {/* ПРАВАЯ ЧАСТЬ: форма */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-slate-50 relative">
        {/* Мягкий градиент на фоне для мобильных */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-brand-50/30 to-slate-50 lg:hidden" />

        <div className="relative w-full max-w-sm">
          {/* Логотип сверху (только мобильный / планшет) */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-9 h-9">
                  <rect x="90" y="210" width="220" height="120" rx="12" fill="#fbbf24" />
                  <path d="M310 250 L372 250 L412 288 L412 330 L310 330 Z" fill="#fbbf24" />
                  <circle cx="155" cy="350" r="30" fill="#fbbf24" />
                  <circle cx="155" cy="350" r="13" fill="#0f172a" />
                  <circle cx="355" cy="350" r="30" fill="#fbbf24" />
                  <circle cx="355" cy="350" r="13" fill="#0f172a" />
                </svg>
              </div>
            </div>
            <div className="text-lg font-bold text-slate-900 tracking-wide">RAIBUILDING</div>
            <div className="text-xs text-slate-500 tracking-widest uppercase mt-0.5">
              Logistics CRM
            </div>
          </div>

          {/* Карточка */}
          <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-900/5 border border-slate-100">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Вход в систему</h2>
              <p className="text-sm text-slate-500 mt-1">
                Введите логин и пароль для продолжения
              </p>
            </div>

            <LoginForm />
          </div>

          {/* Мелкий футер */}
          <div className="text-center mt-6 text-xs text-slate-400">
            © {new Date().getFullYear()} Raibuilding Sp. z o.o.
          </div>
        </div>
      </div>
    </main>
  );
}
