import { useCallback, useEffect, useState } from 'react';
import { Send, Loader2, Link2, RefreshCw, FileBarChart, Users, Handshake, ExternalLink } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { InlineNotice, type Notice } from '@/components/inbound/InlineNotice';
import { callTelegramBot } from '@/lib/telegram';

type BotStatus = {
  tokenConfigured: boolean;
  connected: boolean;
  username: string | null;
  staffLinked: number;
  staffTotal: number;
  partnersLinked: number;
};

const SETUP_ERRORS: Record<string, 'tgTokenMissing' | 'tgErrTokenInvalid'> = {
  TOKEN_MISSING: 'tgTokenMissing',
  TOKEN_INVALID: 'tgErrTokenInvalid',
};

export function TelegramBotCard({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useApp();
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'setup' | 'report' | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await callTelegramBot<BotStatus>('status');
      if (typeof s.tokenConfigured !== 'boolean') throw new Error('bad');
      setStatus(s);
    } catch {
      setNotice({ kind: 'error', text: t('tgErrFailed') });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    setBusy('setup');
    setNotice(null);
    try {
      const r = await callTelegramBot<{ ok: boolean; error?: string }>('setup');
      if (!r.ok) throw new Error(r.error);
      setNotice({ kind: 'success', text: t('tgConnectedOk') });
      await load();
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      setNotice({ kind: 'error', text: t(SETUP_ERRORS[code] ?? 'tgErrFailed') });
    } finally {
      setBusy(null);
    }
  };

  const sendReport = async () => {
    setBusy('report');
    setNotice(null);
    try {
      await callTelegramBot('test_report');
      setNotice({ kind: 'success', text: t('tgReportSent') });
    } catch {
      setNotice({ kind: 'error', text: t('tgErrFailed') });
    } finally {
      setBusy(null);
    }
  };

  const connected = !!status?.connected && !!status.tokenConfigured;

  return (
    <div className="card p-6 lg:col-span-2">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300">
            <Send className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('tgTitle')}</h3>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">{t('tgSubtitle')}</p>
          </div>
        </div>
        {!loading && status && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${connected
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
            : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {connected ? t('tgConnected') : t('tgNotConnected')}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />{t('loading')}</div>
      ) : (
        <div className="space-y-5">
          {status && !status.tokenConfigured && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
              <p className="mb-3 text-sm font-semibold text-amber-800 dark:text-amber-300">{t('tgTokenMissing')}</p>
              <ol className="space-y-2">
                {(['tgStep1', 'tgStep2', 'tgStep3', 'tgStep4'] as const).map((k, i) => (
                  <li key={k} className="flex gap-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-semibold text-amber-800 dark:bg-amber-800/50 dark:text-amber-200">{i + 1}</span>
                    {t(k)}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {status && connected && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat icon={Users} label={t('tgStaffLinked')} value={`${status.staffLinked} / ${status.staffTotal}`} />
              <Stat icon={Handshake} label={t('tgPartnersLinked')} value={String(status.partnersLinked)} />
              {status.username && (
                <a href={`https://t.me/${status.username}`} target="_blank" rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-xl border border-slate-200 p-4 transition-colors hover:border-sky-300 hover:bg-sky-50/50 dark:border-slate-700 dark:hover:border-sky-700 dark:hover:bg-sky-900/10">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('tgOpenBot')}</p>
                    <p className="mt-1 text-sm font-semibold text-sky-700 dark:text-sky-300">@{status.username}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                </a>
              )}
            </div>
          )}

          {connected && <p className="text-xs text-slate-500 dark:text-slate-400">{t('tgDailyNote')}</p>}

          <InlineNotice notice={notice} onClose={() => setNotice(null)} />

          <div className="flex flex-wrap items-center gap-3">
            {isAdmin ? (
              <button onClick={connect} disabled={busy !== null || !status?.tokenConfigured} className="btn-primary disabled:opacity-50">
                {busy === 'setup' ? <Loader2 className="h-4 w-4 animate-spin" /> : connected ? <RefreshCw className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                {connected ? t('tgReconnect') : t('tgConnect')}
              </button>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('tgAdminOnly')}</p>
            )}
            {connected && (
              <button onClick={sendReport} disabled={busy !== null} className="btn-secondary disabled:opacity-50">
                {busy === 'report' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileBarChart className="h-4 w-4" />}
                {t('tgSendReport')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <Icon className="h-5 w-5 text-slate-400" />
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      </div>
    </div>
  );
}
