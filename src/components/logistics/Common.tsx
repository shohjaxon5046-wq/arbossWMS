import { useApp } from '@/contexts/AppContext';
import { formatCurrency } from '@/lib/format';
import type { PriceBreakdown } from '@/types/logistics';
import type { TranslationKey } from '@/lib/i18n';

export function BreakdownList({ rows, total }: { rows: PriceBreakdown[]; total: number }) {
  const { t } = useApp();
  return (
    <div className="space-y-1.5 text-sm">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-slate-600 dark:text-slate-300">{t(r.label as TranslationKey)}</span>
            {r.hint && <span className="ml-1.5 text-xs text-slate-400">{r.hint}</span>}
          </div>
          <span className={`flex-shrink-0 tabular-nums ${r.accent === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : r.accent === 'negative' ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>
            {formatCurrency(r.amount)}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-slate-200 pt-2 dark:border-slate-700">
        <span className="font-semibold text-slate-900 dark:text-slate-100">Jami</span>
        <span className="text-base font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

export function StatPill({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export function formatPhoneMask(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 9) return `+998${digits}`;
  return `+${digits}`;
}
