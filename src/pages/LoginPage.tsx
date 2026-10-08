import { useState } from 'react';
import { Building2, Loader2, Moon, Sun, Languages } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import type { UserRole } from '@/types';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const { t, lang, setLang, theme, toggleTheme } = useApp();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError(t('fillingFields'));
      return;
    }

    if (mode === 'signup' && !fullName) {
      setError(t('fillingFields'));
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: signInError } = await signIn(email, password);
        if (signInError) setError(signInError);
      } else {
        const { error: signUpError } = await signUp(email, password, fullName, phone, role);
        if (signUpError) setError(signUpError);
        else setError(t('signupSuccess'));
      }
    } catch {
      setError(t('loginError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          onClick={() => setLang(lang === 'uz' ? 'ru' : 'uz')}
          className="flex items-center gap-1.5 rounded-lg bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur hover:bg-white dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Languages className="h-4 w-4" />
          {lang === 'uz' ? 'RU' : 'UZ'}
        </button>
        <button
          onClick={toggleTheme}
          className="rounded-lg bg-white/80 p-2 text-slate-700 shadow-sm backdrop-blur hover:bg-white dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">{t('appName')}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('appTagline')}</p>
        </div>

        <div className="card p-8">
          <div className="mb-6 flex gap-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                mode === 'login'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t('login')}
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                mode === 'signup'
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t('signup')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('fullName')}</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input-field"
                    placeholder="Aliyev Vali"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('phone')}</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input-field"
                    placeholder="+998 90 123-45-67"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('role')}</label>
                  <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="input-field">
                    <option value="admin">{t('admin')}</option>
                    <option value="manager">{t('manager')}</option>
                    <option value="seller">{t('seller')}</option>
                    <option value="cashier">{t('cashier')}</option>
                    <option value="warehouse">{t('warehouseWorker')}</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="admin@arenda.uz"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === 'login' ? t('signIn') : t('signUp')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {mode === 'login' ? t('noAccount') : t('haveAccount')}{' '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
              className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {mode === 'login' ? t('signUp') : t('signIn')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
