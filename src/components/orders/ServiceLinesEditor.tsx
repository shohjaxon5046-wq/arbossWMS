import { useState } from 'react';
import { Plus, Trash2, Wrench, Calculator } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency } from '@/lib/format';
import { SERVICE_CATEGORIES } from '@/lib/orders';
import { LogisticsCalculatorModal } from '@/components/logistics/LogisticsCalculatorModal';
import type { ServicePartner } from '@/types';

export interface ServiceLine {
  key: string;
  category: string;
  details: string;
  partner_id: string;
  customer_price: string;
  partner_cost: string;
  address: string;
  scheduled_time: string;
}

export function newServiceLine(address = ''): ServiceLine {
  return {
    key: crypto.randomUUID(), category: SERVICE_CATEGORIES[0].value, details: '', partner_id: '',
    customer_price: '', partner_cost: '', address, scheduled_time: '',
  };
}

interface Props {
  lines: ServiceLine[];
  partners: ServicePartner[];
  onChange: (lines: ServiceLine[]) => void;
  defaultAddress: string;
}

export function ServiceLinesEditor({ lines, partners, onChange, defaultAddress }: Props) {
  const { t } = useApp();
  const [calcModalOpen, setCalcModalOpen] = useState(false);
  const [targetLineKey, setTargetLineKey] = useState<string | null>(null);

  const update = (key: string, patch: Partial<ServiceLine>) =>
    onChange(lines.map(l => (l.key === key ? { ...l, ...patch } : l)));

  const handleApplyEstimate = (summary: {
    machineryName: string;
    distanceKm: number;
    cargoTypeName: string;
    totalCost: number;
    fuelCost: number;
    driverFee: number;
  }) => {
    if (targetLineKey) {
      update(targetLineKey, {
        partner_cost: String(summary.totalCost),
        customer_price: String(Math.round(summary.totalCost * 1.25)), // 25% ustama
        details: `${summary.machineryName} (${summary.distanceKm} km, ${summary.cargoTypeName}) | Yoqilg'i: ${formatCurrency(summary.fuelCost)}, Haydovchi: ${formatCurrency(summary.driverFee)}`,
      });
    } else {
      // Yangi xizmat qatori sifatida qo'shish
      const newLine: ServiceLine = {
        key: crypto.randomUUID(),
        category: 'avtokran',
        details: `${summary.machineryName} (${summary.distanceKm} km, ${summary.cargoTypeName}) | Yoqilg'i: ${formatCurrency(summary.fuelCost)}, Haydovchi: ${formatCurrency(summary.driverFee)}`,
        partner_id: '',
        partner_cost: String(summary.totalCost),
        customer_price: String(Math.round(summary.totalCost * 1.25)),
        address: defaultAddress,
        scheduled_time: '',
      };
      onChange([...lines, newLine]);
    }
    setTargetLineKey(null);
  };

  return (
    <div className="space-y-3">
      {lines.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-6 text-sm text-slate-400 dark:border-slate-700">
          <Wrench className="h-6 w-6" />
          {t('ordNoServices')}
        </div>
      )}
      {lines.map((l, idx) => {
        const options = partners.filter(p => p.service_category === l.category);
        const profit = (Number(l.customer_price) || 0) - (Number(l.partner_cost) || 0);
        return (
          <div key={l.key} className="space-y-3 rounded-xl border border-slate-200 p-3 animate-fade-in dark:border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('ordStepServices')} #{idx + 1}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTargetLineKey(l.key);
                    setCalcModalOpen(true);
                  }}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                  title="Logistika va transport kalkulyatori"
                >
                  <Calculator className="h-3.5 w-3.5" />
                  <span>Kalkulyator</span>
                </button>
                <button onClick={() => onChange(lines.filter(x => x.key !== l.key))} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={l.category} onChange={e => update(l.key, { category: e.target.value, partner_id: '' })} className="input-field" aria-label={t('ordServiceCategory')}>
                {SERVICE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
              </select>
              <select value={l.partner_id} onChange={e => update(l.key, { partner_id: e.target.value })} className="input-field" aria-label={t('ordPartner')}>
                <option value="">{t('ordNoPartner')}</option>
                {options.map(p => (
                  <option key={p.id} value={p.id}>{p.company_name}{p.is_available ? '' : ` (${t('busy')})`}</option>
                ))}
              </select>
            </div>
            <input value={l.details} onChange={e => update(l.key, { details: e.target.value })} className="input-field" placeholder={t('ordServiceDetails')} maxLength={1000} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={l.address} onChange={e => update(l.key, { address: e.target.value })} className="input-field" placeholder={defaultAddress || t('ordAddress')} maxLength={300} />
              <input value={l.scheduled_time} onChange={e => update(l.key, { scheduled_time: e.target.value })} type="datetime-local" className="input-field" aria-label={t('ordScheduledTime')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">{t('ordCustomerPrice')}</span>
                <input type="number" min="0" value={l.customer_price} onChange={e => update(l.key, { customer_price: e.target.value })} className="input-field" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-500">{t('ordPartnerCost')}</span>
                <input type="number" min="0" value={l.partner_cost} onChange={e => update(l.key, { partner_cost: e.target.value })} className="input-field" />
              </label>
            </div>
            {profit !== 0 && (
              <p className={`text-right text-xs font-medium ${profit > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>
                {t('netProfit')}: {formatCurrency(profit)}
              </p>
            )}
          </div>
        );
      })}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        <button onClick={() => onChange([...lines, newServiceLine(defaultAddress)])}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300 py-2.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20">
          <Plus className="h-4 w-4" /> {t('ordAddService')}
        </button>
        <button
          type="button"
          onClick={() => {
            setTargetLineKey(null);
            setCalcModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50/70 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300"
        >
          <Calculator className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span>Logistika kalkulyatoridan hisoblash</span>
        </button>
      </div>

      {/* Kalkulyator Modali */}
      <LogisticsCalculatorModal
        open={calcModalOpen}
        onClose={() => setCalcModalOpen(false)}
        partners={partners}
        onApplyEstimate={handleApplyEstimate}
      />
    </div>
  );
}
