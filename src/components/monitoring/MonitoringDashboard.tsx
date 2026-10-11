import { useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, AlertCircle, CheckCircle2, Trash2, Download,
  ExternalLink, Send, ShieldAlert, Cpu, RefreshCw, X, Clock, Bug, User,
  Check, Filter, Search, Globe, ChevronRight
} from 'lucide-react';
import { monitoring, type MonitoredError, type SeverityLevel, type PerformanceEvent } from '@/lib/monitoring';
import { Modal } from '@/components/ui/Modal';
import { formatDate } from '@/lib/format';

export function MonitoringDashboard() {
  const [errors, setErrors] = useState<MonitoredError[]>([]);
  const [perfEvents, setPerfEvents] = useState<PerformanceEvent[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedError, setSelectedError] = useState<MonitoredError | null>(null);
  const [activeTab, setActiveTab] = useState<'errors' | 'performance' | 'alerts'>('errors');
  const [webhookUrl, setWebhookUrl] = useState(monitoring.getWebhookUrl());
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const refresh = () => {
    setErrors(monitoring.getErrors());
    setPerfEvents(monitoring.getPerformanceEvents());
  };

  useEffect(() => {
    refresh();
    const unsubscribe = monitoring.subscribe(refresh);
    return () => unsubscribe();
  }, []);

  const filteredErrors = errors.filter(err => {
    const matchesLevel = filterLevel === 'all' || err.level === filterLevel;
    const matchesSearch = !search ||
      err.message.toLowerCase().includes(search.toLowerCase()) ||
      err.source.toLowerCase().includes(search.toLowerCase()) ||
      (err.user?.name && err.user.name.toLowerCase().includes(search.toLowerCase()));
    return matchesLevel && matchesSearch;
  });

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(errors, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `arboss_errors_report_${Date.now()}.json`);
    dlAnchorElem.click();
  };

  const handleClearLogs = () => {
    if (window.confirm('Barcha monitoring loglarini tozalashni xohlaysizmi?')) {
      monitoring.clearErrors();
      refresh();
    }
  };

  const handleSaveWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    monitoring.setWebhookUrl(webhookUrl);
    setWebhookSaved(true);
    setTimeout(() => setWebhookSaved(false), 3000);
  };

  const handleTestAlert = () => {
    monitoring.captureException(new Error('Simulated Critical Test Error: Alert dispatcher verification'), {
      source: 'manual',
      level: 'fatal',
      simulated: true,
      notes: 'Testing real-time webhook alert dispatch pipeline',
    });
    setTestSent(true);
    setTimeout(() => setTestSent(false), 4000);
  };

  const handleSimulateError = (type: 'type_error' | 'promise_rejection' | 'slow_call') => {
    if (type === 'type_error') {
      try {
        const obj: any = null;
        obj.nonExistentMethod();
      } catch (err) {
        monitoring.captureException(err, { source: 'uncaught_exception', level: 'error' });
      }
    } else if (type === 'promise_rejection') {
      monitoring.captureException(new Error('Network connection aborted to upstream inventory cluster'), {
        source: 'unhandled_rejection',
        level: 'warning',
      });
    } else if (type === 'slow_call') {
      monitoring.trackPerformance('Batch Stock Recalculation', async () => {
        await new Promise(r => setTimeout(r, 1600));
        return true;
      }, { simulated: true });
    }
  };

  const getLevelBadge = (level: SeverityLevel) => {
    switch (level) {
      case 'fatal':
        return <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800 dark:bg-red-900/40 dark:text-red-300">FATAL</span>;
      case 'error':
        return <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">ERROR</span>;
      case 'warning':
        return <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">WARN</span>;
      case 'info':
        return <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">INFO</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Xatoliklar monitoringi va diagnostika (Sentry & APM)
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Ilovaning barcha kutilmagan xatolari, stack trace, foydalanuvchi qadami (breadcrumbs) va tezlik ko'rsatkichlari.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportJson}
            disabled={errors.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Eksport (JSON)</span>
          </button>
          <button
            onClick={handleClearLogs}
            disabled={errors.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Tozalash</span>
          </button>
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Yangilash</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Jami qayd etilgan</span>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{errors.length}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Oxirgi sessiyalar bo'yicha</p>
        </div>

        <div className="card p-4 border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Kritik xatolar (Fatal/Error)</span>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
            {errors.filter(e => e.level === 'fatal' || e.level === 'error').length}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">Zudlik bilan bartaraf etilishi lozim</p>
        </div>

        <div className="card p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Ogohlantirishlar (Warnings)</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {errors.filter(e => e.level === 'warning').length}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">Kichik aloqa va validatsiya uzilishlari</p>
        </div>

        <div className="card p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">APM Tezlik hodisalari</span>
            <Cpu className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{perfEvents.length}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">O'lchangan operatsiyalar</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('errors')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
            activeTab === 'errors'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bug className="h-4 w-4" />
          <span>Xatolar ro'yxati ({filteredErrors.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('performance')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
            activeTab === 'performance'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Cpu className="h-4 w-4" />
          <span>APM & Tezlik ({perfEvents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition ${
            activeTab === 'alerts'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Send className="h-4 w-4" />
          <span>Alertlar & Webhook sozlash</span>
        </button>
      </div>

      {/* TAB 1: ERRORS */}
      {activeTab === 'errors' && (
        <div className="space-y-4">
          {/* Controls & Simulators */}
          <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Xatolik matni yoki manba bo'yicha qidirish..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="input-field pl-9 text-xs"
                />
              </div>

              <select
                value={filterLevel}
                onChange={e => setFilterLevel(e.target.value)}
                className="input-field text-xs w-36"
              >
                <option value="all">Barcha darajalar</option>
                <option value="fatal">Faqat Fatal</option>
                <option value="error">Faqat Error</option>
                <option value="warning">Faqat Warning</option>
                <option value="info">Faqat Info</option>
              </select>
            </div>

            {/* Test Simulation Buttons */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-400 mr-1">Test qilish:</span>
              <button
                onClick={() => handleSimulateError('type_error')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
              >
                TypeError
              </button>
              <button
                onClick={() => handleSimulateError('promise_rejection')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
              >
                Network Err
              </button>
              <button
                onClick={() => handleSimulateError('slow_call')}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
              >
                Slow Query
              </button>
            </div>
          </div>

          {/* Errors List */}
          {filteredErrors.length === 0 ? (
            <div className="card p-10 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                Ajoyib! Hech qanday faol xatolik mavjud emas.
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                Ilova barqaror ishlamoqda. Yuqoridagi "Test qilish" tugmalari orqali monitoring tizimini sinab ko'rishingiz mumkin.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {filteredErrors.map(err => (
                <div
                  key={err.id}
                  onClick={() => setSelectedError(err)}
                  className="flex cursor-pointer items-start justify-between gap-4 p-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5">{getLevelBadge(err.level)}</div>
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                        {err.message}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-slate-800">
                          {err.source}
                        </span>
                        <span>•</span>
                        <span>{formatDate(err.timestamp)}</span>
                        {err.user && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                              <User className="h-3 w-3" />
                              {err.user.name || err.user.email} ({err.user.role})
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span>{err.breadcrumbs.length} ta hodisa (breadcrumbs)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
                      Batafsil
                    </button>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: APM & PERFORMANCE */}
      {activeTab === 'performance' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Operatsiyalar davomiyligi va APM ko'rsatkichlari
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Real vaqtda asinxron operatsiyalar, ma'lumotlar bazasi so'rovlari va API javob tezligi o'lchovlari.
            </p>
          </div>

          {perfEvents.length === 0 ? (
            <div className="card p-8 text-center text-xs text-slate-400">
              Hozircha tezlik hodisalari o'lchanmadi. Ilovada turli bo'limlarga o'ting yoki test operatsiyasini boshlang.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr>
                    <th className="p-3 font-semibold">Operatsiya nomi</th>
                    <th className="p-3 font-semibold">Davomiyligi</th>
                    <th className="p-3 font-semibold">Holati</th>
                    <th className="p-3 font-semibold">Vaqt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {perfEvents.map(evt => (
                    <tr key={evt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="p-3 font-mono font-medium text-slate-900 dark:text-slate-100">{evt.name}</td>
                      <td className="p-3">
                        <span className={`font-mono font-bold ${evt.durationMs > 1000 ? 'text-rose-600' : evt.durationMs > 300 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {evt.durationMs} ms
                        </span>
                      </td>
                      <td className="p-3">
                        {evt.success ? (
                          <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Muvaffaqiyatli</span>
                        ) : (
                          <span className="badge bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">Xatolik</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400">{formatDate(evt.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WEBHOOK ALERTS */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Kritik xatolar uchun avtomatlashtirilgan webhook bildirishnomalari
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Ilovada kutilmagan `FATAL` yoki `ERROR` darajasidagi nosozlik sodir bo'lganda, tizim ushbu webhook URL manziliga (masalan, Telegram bot serveri, Discord yoki Sentry/LogRocket webhooki) zudlik bilan hodisa paketini yuboradi.
            </p>

            <form onSubmit={handleSaveWebhook} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Webhook URL (HTTP POST)
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="url"
                    placeholder="https://api.telegram.org/bot... yoki https://webhook.site/..."
                    value={webhookUrl}
                    onChange={e => setWebhookUrl(e.target.value)}
                    className="input-field text-xs flex-1"
                  />
                  <button type="submit" className="btn-primary text-xs px-4">
                    Saqlash
                  </button>
                </div>
              </div>

              {webhookSaved && (
                <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" /> Webhook manzili saqlandi!
                </p>
              )}
            </form>

            <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={handleTestAlert}
                className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Test ogohlantirishini jo'natish</span>
              </button>
              {testSent && (
                <p className="mt-2 text-xs text-emerald-600">
                  ✓ Test hodisasi qayd etildi va webhookka uzatildi!
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ERROR DETAIL MODAL */}
      {selectedError && (
        <Modal
          open={!!selectedError}
          onClose={() => setSelectedError(null)}
          title={`Xatolik tafsiloti: ${selectedError.id}`}
          size="xl"
        >
          <div className="space-y-5 text-xs">
            {/* Header badges */}
            <div className="flex flex-wrap items-center gap-3">
              {getLevelBadge(selectedError.level)}
              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Manba: {selectedError.source}
              </span>
              <span className="text-slate-400">
                {formatDate(selectedError.timestamp)}
              </span>
            </div>

            {/* Error Message */}
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 font-mono font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              {selectedError.message}
            </div>

            {/* User & Environment Info */}
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-850">
              <div>
                <p className="font-semibold text-slate-500">Foydalanuvchi:</p>
                <p className="mt-0.5 text-slate-900 dark:text-slate-100">
                  {selectedError.user ? `${selectedError.user.name} (${selectedError.user.role})` : 'Anonim / Chiqilgan'}
                </p>
                <p className="text-slate-400">{selectedError.user?.email || '—'}</p>
              </div>

              <div>
                <p className="font-semibold text-slate-500">Muhit / Brauzer:</p>
                <p className="mt-0.5 text-slate-900 dark:text-slate-100">
                  Onlayn: {selectedError.performanceMetrics?.online ? 'Ha' : 'Yo\'q'}
                  {selectedError.performanceMetrics?.memoryUsageMB && ` · Xotira: ${selectedError.performanceMetrics.memoryUsageMB} MB`}
                </p>
                <p className="truncate text-slate-400 text-[11px]" title={selectedError.performanceMetrics?.userAgent}>
                  {selectedError.performanceMetrics?.userAgent || '—'}
                </p>
              </div>
            </div>

            {/* Stack Trace */}
            {selectedError.stack && (
              <div>
                <p className="mb-1.5 font-semibold text-slate-700 dark:text-slate-300">Stack Trace:</p>
                <pre className="max-h-48 overflow-x-auto rounded-xl bg-slate-950 p-3.5 font-mono text-[11px] leading-relaxed text-slate-200">
                  {selectedError.stack}
                </pre>
              </div>
            )}

            {/* Breadcrumbs Trail */}
            <div>
              <p className="mb-2 font-semibold text-slate-700 dark:text-slate-300">
                Foydalanuvchi qadamlari (Breadcrumbs trail):
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                {selectedError.breadcrumbs.length === 0 ? (
                  <p className="text-slate-400">Hodisalar tarixi yo'q.</p>
                ) : (
                  selectedError.breadcrumbs.map((b, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                          {b.category}
                        </span>
                        <span className="text-slate-700 dark:text-slate-300">{b.message}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(b.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Close */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedError(null)}
                className="btn-primary px-4 py-2 text-xs"
              >
                Yopish
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
