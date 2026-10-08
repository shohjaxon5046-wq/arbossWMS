import { Lock, TrendingDown } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency } from '@/lib/format';
import { rentLineTotal } from '@/lib/orders';
import { FieldLabel } from '@/components/inbound/InlineNotice';
import type { ModelForm } from '@/components/catalog/modelForm';

export function PricingTab({ form, setForm, editable }: { form: ModelForm; setForm: (f: ModelForm) => void; editable: boolean }) {
  const { t } = useApp();
  const priceModel = {
    daily_price: Number(form.daily_price) || 0,
    weekly_discount_pct: Number(form.weekly_discount_pct) || 0,
    monthly_discount_pct: Number(form.monthly_discount_pct) || 0,
  };
  const field = (key: keyof ModelForm, label: string, placeholder: string, suffix?: string) => (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <div className="relative">
        <input
          type="number" min={0} inputMode="numeric" disabled={!editable}
          value={form[key] as string}
          onChange={e => setForm({ ...form, [key]: e.target.value })}
          className={`input-field ${suffix ? 'pr-12' : ''} disabled:cursor-not-allowed disabled:opacity-60`}
          placeholder={placeholder}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {!editable && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <Lock className="h-4 w-4 flex-shrink-0" /> {t('catAdminOnly')}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {field('daily_price', t('catDailyPrice'), '50000', "so'm")}
        {field('deposit_amount', t('catDeposit'), '300000', "so'm")}
        {field('weekly_discount_pct', t('catWeeklyDiscount'), '10', '%')}
        {field('monthly_discount_pct', t('catMonthlyDiscount'), '25', '%')}
      </div>

      <label className={`flex items-center justify-between rounded-xl border border-slate-200 p-4 dark:border-slate-700 ${editable ? 'cursor-pointer' : 'opacity-60'}`}>
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{t('catActive')}</span>
        <span className="relative inline-flex">
          <input type="checkbox" disabled={!editable} checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="peer sr-only" />
          <span className="h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-emerald-500 dark:bg-slate-600" />
          <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
        </span>
      </label>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('catPreview')}</p>
        <div className="grid grid-cols-3 gap-3">
          {[1, 7, 30].map(days => (
            <div key={days} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <p className="text-xs text-slate-500">{days} {t('catPreviewDays')}</p>
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">{formatCurrency(rentLineTotal(priceModel, days))}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <div className="mb-3 flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-red-500" />
          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{t('catDepreciation')}</span>
        </div>
        <div className="max-w-[160px]">{field('depreciation_pct', '', '2', '%')}</div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t('catDepreciationHint')}</p>
      </div>
    </div>
  );
}
