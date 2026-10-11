import { useState } from 'react';
import { Building2, Loader2, Moon, Sun, Languages, Shield, UserCheck, ShoppingBag, Receipt, Warehouse } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import type { UserRole } from '@/types';

export function LoginPage() {
  const { signIn, switchRole } = useAuth();
  const { t, lang, setLang, theme, toggleTheme } = useApp();
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
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50/50 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          onClick={() => setLang(lang === 'uz' ? 'ru' : 'uz')}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur hover:bg-white dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200"
        >
          <Languages className="h-4 w-4" />
          {lang === 'uz' ? 'RU' : 'UZ'}
        </button>
        <button
          onClick={toggleTheme}
          className="rounded-lg border border-slate-200 bg-white/90 p-2 text-slate-700 shadow-sm backdrop-blur hover:bg-white dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-xl shadow-blue-600/30">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Arboss WMS & Arenda ERP
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {lang === 'uz' ? 'Qurilish uskunalari ijarasi va ombor tizimi' : 'Система аренды строительного оборудования и WMS'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                {t('email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                placeholder="admin@arboss.uz"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                {t('password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
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
          <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
            <p className="mb-3 text-center text-xs font-medium text-slate-400">
              {lang === 'uz' ? '⚡ Tezkor sinov (Demo rollar)' : '⚡ Быстрый вход (Тестовые роли)'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickRole('admin')}
                className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300"
              >
                <Shield className="h-3.5 w-3.5" />
                <span>Admin</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickRole('manager')}
                className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Menejer</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickRole('seller')}
                className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>Sotuvchi</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickRole('cashier')}
                className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-700 transition hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
              >
                <Receipt className="h-3.5 w-3.5" />
                <span>Kassir</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickRole('warehouse')}
                className="col-span-2 flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-purple-50/70 px-3 py-2 text-xs font-medium text-purple-700 transition hover:bg-purple-100 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-300"
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
