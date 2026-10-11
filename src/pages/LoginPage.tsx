import { useState } from 'react';
import { Building2, Loader2, Languages, Shield, UserCheck, ShoppingBag, Receipt, Warehouse } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import type { UserRole } from '@/types';

export function LoginPage() {
  const { signIn, switchRole } = useAuth();
  const { t, lang, setLang } = useApp();
  const [email, setEmail] = useState('admin@arboss.uz');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError(t('fillingFields'));
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) setError(signInError);
    } catch {
      setError(t('loginError'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickRole = async (role: UserRole) => {
    setLoading(true);
    try {
      await switchRole(role);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          onClick={() => setLang(lang === 'uz' ? 'ru' : 'uz')}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Languages className="h-4 w-4" />
          {lang === 'uz' ? 'RU' : 'UZ'}
        </button>
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg shadow-blue-600/25">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Arboss WMS & Arenda ERP
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {lang === 'uz' ? 'Qurilish uskunalari ijarasi va ombor tizimi' : 'Система аренды строительного оборудования и WMS'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {t('email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                placeholder="admin@arboss.uz"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                {t('password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/30 transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('signIn')}
            </button>
          </form>

          {/* Quick Demo Access Buttons */}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="mb-3 text-center text-xs font-medium text-slate-500">
              {lang === 'uz' ? '⚡ Tezkor sinov (Demo rollar)' : '⚡ Быстрый вход (Тестовые роли)'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickRole('admin')}
                className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                <Shield className="h-3.5 w-3.5" />
                <span>Admin</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickRole('manager')}
                className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Menejer</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickRole('seller')}
                className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>Sotuvchi</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickRole('cashier')}
                className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
              >
                <Receipt className="h-3.5 w-3.5" />
                <span>Kassir</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickRole('warehouse')}
                className="col-span-2 flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-purple-50/70 px-3 py-2 text-xs font-semibold text-purple-700 transition hover:bg-purple-100"
              >
                <Warehouse className="h-3.5 w-3.5" />
                <span>Omborchi (Sklad)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
