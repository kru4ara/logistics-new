import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔐</div>
          <h1 className="text-2xl font-bold text-slate-900">Вход в систему</h1>
          <p className="text-sm text-slate-500 mt-1">Logistics CRM</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
