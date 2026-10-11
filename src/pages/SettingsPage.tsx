import { useEffect, useState, useCallback, useRef } from 'react';
import { Building2, Save, Languages, Check, Database, Download, Upload, RotateCcw, Activity, ShieldCheck, Settings } from 'lucide-react';
import { supabase, resetDatabaseToDefaults, exportDatabaseBackup, importDatabaseBackup } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner, ErrorState, PageHeader } from '@/components/ui/States';
import { TelegramBotCard } from '@/components/settings/TelegramBotCard';
import { MonitoringDashboard } from '@/components/monitoring/MonitoringDashboard';
import { TestSuiteDashboard } from '@/components/testing/TestSuiteDashboard';

export function SettingsPage() {
  const { t, lang, setLang } = useApp();
  const { staff } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'monitoring' | 'tests'>('general');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [companyName, setCompanyName] = useState('Arboss WMS & Arenda ERP');
  const [phone, setPhone] = useState('+998 (71) 200-50-46');
  const [address, setAddress] = useState('7-o\'tish joyi Bo\'zbozor, 36');
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
          if (s.key === 'company_address') setAddress(s.value?.address || '7-o\'tish joyi Bo\'zbozor, 36');
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
        subtitle={lang === 'uz' ? 'Kompaniya ma\'lumotlari, tariflar, zaxira va tizim diagnostikasi' : 'Параметры компании, тарифы, резервные копии и диагностика'}
      />

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
            activeTab === 'general'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>{lang === 'uz' ? 'Tizim sozlamalari' : 'Настройки системы'}</span>
        </button>

        <button
          onClick={() => setActiveTab('monitoring')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
            activeTab === 'monitoring'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="h-4 w-4" />
          <span>{lang === 'uz' ? 'Xatoliklar monitoringi (Sentry & APM)' : 'Мониторинг ошибок'}</span>
        </button>

        <button
          onClick={() => setActiveTab('tests')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
            activeTab === 'tests'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>{lang === 'uz' ? 'Avtomatlashtirilgan testlar (Test Suite)' : 'Авто-тесты'}</span>
        </button>
      </div>

      {activeTab === 'monitoring' && <MonitoringDashboard />}
      {activeTab === 'tests' && <TestSuiteDashboard />}

      {activeTab === 'general' && (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Company Info */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">{t('companyInfo')}</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">{t('companyName')}</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">{t('phone')}</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none" placeholder="+998 90 123-45-67" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">{t('address2')}</label>
              <input value={address} onChange={e => setAddress(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
        </div>

        {/* Language Selection */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">{t('appearance')}</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-700">{t('language')}</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLang('uz')}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${lang === 'uz' ? 'bg-blue-600 text-white shadow-sm font-semibold' : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
                >
                  <Languages className="h-4 w-4" /> O'zbekcha
                </button>
                <button
                  type="button"
                  onClick={() => setLang('ru')}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${lang === 'ru' ? 'bg-blue-600 text-white shadow-sm font-semibold' : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
                >
                  <Languages className="h-4 w-4" /> Русский
                </button>
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
              <p className="font-semibold">{lang === 'uz' ? 'Kunduzgi rejim (Light theme)' : 'Светлая тема (Light theme)'}</p>
              <p className="mt-0.5 text-blue-600">{lang === 'uz' ? 'Tizim optimal ko\'rinish va tezkor ishlash uchun doimiy kunduzgi rejimda ishlaydi.' : 'Система всегда работает в светлом дневном режиме.'}</p>
            </div>
          </div>
        </div>

        {/* Database & Backup Management */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              {lang === 'uz' ? 'Ma\'lumotlar bazasi va zaxira nusxalar (Offline / Sync)' : 'База данных и резервное копирование'}
            </h3>
          </div>
          <p className="mb-4 text-xs text-slate-500">
            {lang === 'uz'
              ? 'Arboss WMS xavfsiz va uzluksiz ishlash uchun lokal ma\'lumotlar bazasidan foydalanadi. Siz istalgan vaqtda barcha ma\'lumotlarni JSON faylga eksport qilishingiz, qayta yuklashingiz yoki boshlang\'ich demo holatiga qaytarishingiz mumkin.'
              : 'Система хранит данные локально и поддерживает полную синхронизацию. Вы можете скачать резервную копию JSON или сбросить демо-данные.'}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportBackup}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
            >
              <Download className="h-4 w-4 text-blue-600" />
              <span>{lang === 'uz' ? 'Zaxira nusxasini yuklab olish (JSON)' : 'Экспорт базы (JSON)'}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
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
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/70 px-4 py-2.5 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100"
            >
              <RotateCcw className="h-4 w-4 text-red-600" />
              <span>{lang === 'uz' ? 'Standart ma\'lumotlarni tiklash (Reset Demo)' : 'Сброс к демо-данным'}</span>
            </button>
          </div>

          {importStatus && (
            <p className="mt-3 text-xs font-medium text-emerald-600">{importStatus}</p>
          )}
        </div>

        {(staff?.role === 'admin' || staff?.role === 'manager') && <TelegramBotCard isAdmin={staff.role === 'admin'} />}

        {/* Profile */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">{t('profile')}</h3>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-xl font-bold text-white shadow-md">
              {staff?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <p className="text-base font-bold text-slate-900">{staff?.full_name || 'Admin'}</p>
              <p className="text-xs text-slate-500">{staff?.email || 'admin@arboss.uz'}</p>
              <p className="text-xs text-slate-500">{staff?.phone || '+998 90 504 60 01'}</p>
            </div>
          </div>
        </div>
      </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/30 transition hover:bg-blue-700"
          >
            <Save className="h-4 w-4" />
            <span>{t('saveSettings')}</span>
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <Check className="h-4 w-4" />
              <span>{t('settingsSaved')}</span>
            </span>
          )}
        </div>
      </>
      )}
    </div>
  );
}
