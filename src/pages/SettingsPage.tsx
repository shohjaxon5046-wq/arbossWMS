import { useEffect, useState, useCallback } from 'react';
import { Building2, Save, Moon, Sun, Languages, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner, ErrorState, PageHeader } from '@/components/ui/States';
import { TelegramBotCard } from '@/components/settings/TelegramBotCard';

export function SettingsPage() {
  const { t, lang, setLang, theme, toggleTheme } = useApp();
  const { staff } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [companyName, setCompanyName] = useState('WMS Arenda ERP');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [rates, setRates] = useState({ uskuna: 0, kran: 0, musir: 0, gruzchik: 0 });

  const loadData = useCallback(async () => {
    try {
      const { data } = await supabase.from('erp_settings').select('*');
      if (data && data.length > 0) {
        for (const s of data) {
          if (s.key === 'company_name') setCompanyName(s.value?.name || 'WMS Arenda ERP');
          if (s.key === 'company_phone') setPhone(s.value?.phone || '');
          if (s.key === 'company_address') setAddress(s.value?.address || '');
          if (s.key === 'commission_rates') setRates(s.value as any || { uskuna: 0, kran: 0, musir: 0, gruzchik: 0 });
        }
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    try {
      const settings = [
        { key: 'company_name', value: { name: companyName } },
        { key: 'company_phone', value: { phone } },
        { key: 'company_address', value: { address } },
        { key: 'commission_rates', value: rates },
      ];
      for (const s of settings) {
        await supabase.from('erp_settings').upsert(s, { onConflict: 'key' });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save error');
    }
  };

  if (loading) return <LoadingSpinner text={t('loading')} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <PageHeader title={t('systemSettings')} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Company Info */}
        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('companyInfo')}</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('companyName')}</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('phone')}</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} className="input-field" placeholder="+998 90 123-45-67" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('address2')}</label>
              <input value={address} onChange={e => setAddress(e.target.value)} className="input-field" />
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="card p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('appearance')}</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('language')}</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setLang('uz')}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${lang === 'uz' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                >
                  <Languages className="h-4 w-4" /> O'zbek
                </button>
                <button
                  onClick={() => setLang('ru')}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${lang === 'ru' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                >
                  <Languages className="h-4 w-4" /> Русский
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('theme')}</label>
              <div className="flex gap-2">
                <button
                  onClick={() => theme === 'dark' && toggleTheme()}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${theme === 'light' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                >
                  <Sun className="h-4 w-4" /> {t('lightMode')}
                </button>
                <button
                  onClick={() => theme === 'light' && toggleTheme()}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                >
                  <Moon className="h-4 w-4" /> {t('darkMode')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {(staff?.role === 'admin' || staff?.role === 'manager') && <TelegramBotCard isAdmin={staff.role === 'admin'} />}

        {/* Commission Rates */}
        {staff?.role === 'admin' && (
          <div className="card p-6">
            <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Sotuvchilar uchun bonus foizlari (%)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Uskuna ijarasi (%)</label>
                <input type="number" min="0" max="100" value={rates.uskuna} onChange={e => setRates(r => ({ ...r, uskuna: Number(e.target.value) }))} className="input-field" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Kran xizmati (%)</label>
                <input type="number" min="0" max="100" value={rates.kran} onChange={e => setRates(r => ({ ...r, kran: Number(e.target.value) }))} className="input-field" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Chiqindi (Musor) (%)</label>
                <input type="number" min="0" max="100" value={rates.musir} onChange={e => setRates(r => ({ ...r, musir: Number(e.target.value) }))} className="input-field" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Gruzchik (%)</label>
                <input type="number" min="0" max="100" value={rates.gruzchik} onChange={e => setRates(r => ({ ...r, gruzchik: Number(e.target.value) }))} className="input-field" />
              </div>
            </div>
          </div>
        )}
        {/* Profile */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('profile')}</h3>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-xl font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {staff?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{staff?.full_name || 'User'}</p>
              <p className="text-sm text-slate-400">{staff?.email || '—'}</p>
              <p className="text-sm text-slate-400">{staff?.phone || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} className="btn-primary">
          <Save className="h-4 w-4" /> {t('saveSettings')}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" /> {t('settingsSaved')}
          </span>
        )}
      </div>
    </div>
  );
}
