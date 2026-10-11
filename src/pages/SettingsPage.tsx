import { useEffect, useState, useCallback, useRef } from 'react';
import { Building2, Save, Moon, Sun, Languages, Check, Database, Download, Upload, RotateCcw, AlertTriangle } from 'lucide-react';
import { supabase, resetDatabaseToDefaults, exportDatabaseBackup, importDatabaseBackup } from '@/lib/supabase';
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
  const [companyName, setCompanyName] = useState('Arboss WMS & Arenda ERP');
  const [phone, setPhone] = useState('+998 (71) 200-50-46');
  const [address, setAddress] = useState('Toshkent sh., Chilonzor tumani, Bunyodkor shoh ko\'chasi, 42-ombor');
  const [rates, setRates] = useState({ uskuna: 5, kran: 8, musir: 7, gruzchik: 10 });
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    try {
      const { data } = await supabase.from('erp_settings').select('*');
      if (data && data.length > 0) {
        for (const s of data) {
          if (s.key === 'company_name') setCompanyName(s.value?.name || 'Arboss WMS & Arenda ERP');
          if (s.key === 'company_phone') setPhone(s.value?.phone || '+998 (71) 200-50-46');
          if (s.key === 'company_address') setAddress(s.value?.address || 'Toshkent sh.');
          if (s.key === 'commission_rates') setRates(s.value as any || { uskuna: 5, kran: 8, musir: 7, gruzchik: 10 });
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

  const handleExportBackup = () => {
    const json = exportDatabaseBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arboss_wms_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content && importDatabaseBackup(content)) {
        setImportStatus('Zaxira muvaffaqiyatli tiklandi! Sahifa yangilanmoqda...');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setImportStatus('Faylni o\'qishda xatolik yuz berdi!');
      }
    };
    reader.readAsText(file);
  };

  const handleResetDefaults = () => {
    if (confirm(lang === 'uz' ? 'Haqiqatan ham barcha ma\'lumotlarni boshlang\'ich demo holatiga qaytarmoqchimisiz?' : 'Действительно сбросить все данные к демо-состоянию?')) {
      resetDatabaseToDefaults();
    }
  };

  if (loading) return <LoadingSpinner text={t('loading')} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('systemSettings')}
        subtitle={lang === 'uz' ? 'Kompaniya ma\'lumotlari, tariflar, zaxira va tizim sozlamalari' : 'Параметры компании, тарифы, резервные копии и интеграции'}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Company Info */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('companyInfo')}</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">{t('companyName')}</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">{t('phone')}</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" placeholder="+998 90 123-45-67" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">{t('address2')}</label>
              <input value={address} onChange={e => setAddress(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('appearance')}</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-700 dark:text-slate-300">{t('language')}</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setLang('uz')}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${lang === 'uz' ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
                >
                  <Languages className="h-4 w-4" /> O'zbekcha
                </button>
                <button
                  onClick={() => setLang('ru')}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${lang === 'ru' ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
                >
                  <Languages className="h-4 w-4" /> Русский
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-700 dark:text-slate-300">{t('theme')}</label>
              <div className="flex gap-2">
                <button
                  onClick={() => theme === 'dark' && toggleTheme()}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${theme === 'light' ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
                >
                  <Sun className="h-4 w-4" /> {t('lightMode')}
                </button>
                <button
                  onClick={() => theme === 'light' && toggleTheme()}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${theme === 'dark' ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
                >
                  <Moon className="h-4 w-4" /> {t('darkMode')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Database & Backup Management */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'uz' ? 'Ma\'lumotlar bazasi va zaxira nusxalar (Offline / Sync)' : 'База данных и резервное копирование'}
            </h3>
          </div>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            {lang === 'uz'
              ? 'Arboss WMS xavfsiz va uzluksiz ishlash uchun lokal ma\'lumotlar bazasidan foydalanadi. Siz istalgan vaqtda barcha ma\'lumotlarni JSON faylga eksport qilishingiz, qayta yuklashingiz yoki boshlang\'ich demo holatiga qaytarishingiz mumkin.'
              : 'Система хранит данные локально и поддерживает полную синхронизацию. Вы можете скачать резервную копию JSON или сбросить демо-данные.'}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportBackup}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Download className="h-4 w-4 text-blue-600" />
              <span>{lang === 'uz' ? 'Zaxira nusxasini yuklab olish (JSON)' : 'Экспорт базы (JSON)'}</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Upload className="h-4 w-4 text-emerald-600" />
              <span>{lang === 'uz' ? 'Zaxiradan tiklash (JSON Import)' : 'Импорт из JSON'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />

            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/70 px-4 py-2.5 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
            >
              <RotateCcw className="h-4 w-4 text-red-600" />
              <span>{lang === 'uz' ? 'Standart ma\'lumotlarni tiklash (Reset Demo)' : 'Сброс к демо-данным'}</span>
            </button>
          </div>

          {importStatus && (
            <p className="mt-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">{importStatus}</p>
          )}
        </div>

        {(staff?.role === 'admin' || staff?.role === 'manager') && <TelegramBotCard isAdmin={staff.role === 'admin'} />}

        {/* Commission Rates */}
        {staff?.role === 'admin' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'uz' ? 'Sotuvchilar uchun bonus foizlari (%)' : 'Бонусные проценты менеджеров (%)'}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Uskuna ijarasi (%)</label>
                <input type="number" min="0" max="100" value={rates.uskuna} onChange={e => setRates(r => ({ ...r, uskuna: Number(e.target.value) }))} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Kran xizmati (%)</label>
                <input type="number" min="0" max="100" value={rates.kran} onChange={e => setRates(r => ({ ...r, kran: Number(e.target.value) }))} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Chiqindi (Musor) (%)</label>
                <input type="number" min="0" max="100" value={rates.musir} onChange={e => setRates(r => ({ ...r, musir: Number(e.target.value) }))} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">Gruzchik (%)</label>
                <input type="number" min="0" max="100" value={rates.gruzchik} onChange={e => setRates(r => ({ ...r, gruzchik: Number(e.target.value) }))} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
              </div>
            </div>
          </div>
        )}

        {/* Profile */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('profile')}</h3>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-xl font-bold text-white shadow-md">
              {staff?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">{staff?.full_name || 'Admin'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{staff?.email || 'admin@arboss.uz'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{staff?.phone || '+998 90 504 60 01'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/30 transition hover:bg-blue-700"
        >
          <Save className="h-4 w-4" />
          <span>{t('saveSettings')}</span>
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" />
            <span>{t('settingsSaved')}</span>
          </span>
        )}
      </div>
    </div>
  );
}
