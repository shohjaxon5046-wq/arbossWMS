import { useEffect, useMemo, useState } from 'react';
import { TrendingDown, TrendingUp, Scale } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { calculateKran, calculateManualForWeight } from '@/lib/logistics';
import { BreakdownList, StatPill } from '@/components/logistics/Common';
import { formatCurrency } from '@/lib/format';
import type { LogisticsPricingData } from '@/types/logistics';

interface Props {
  pricing: LogisticsPricingData;
  onChange: (details: Record<string, unknown>, price: number) => void;
}

export function KranCalculator({ pricing, onChange }: Props) {
  const { t } = useApp();
  const [equipmentId, setEquipmentId] = useState(pricing.equipment[0]?.id ?? '');
  const [weight, setWeight] = useState(100);
  const [floor, setFloor] = useState(1);
  const [hours, setHours] = useState(3);
  const [km, setKm] = useState(10);

  const equipment = pricing.equipment.find(e => e.id === equipmentId);
  const height = floor * 3; // ~3 m per floor

  const quote = useMemo(() => {
    const manual = calculateManualForWeight(weight, floor, km, pricing.loader_settings, pricing.floor_pricing);
    const effectiveHours = Math.max(hours, Number(equipment?.min_hours ?? 1));
    return { ...calculateKran(equipment, weight, effectiveHours, km, pricing.equipment_settings, manual), effectiveHours };
  }, [weight, floor, hours, km, equipment, pricing]);

  useEffect(() => {
    onChange(
      {
        service: 'kran',
        equipment: equipment?.name ?? '',
        cargo_weight: weight,
        floor,
        hours: quote.effectiveHours,
        km,
        manual_total: quote.manual_total,
      },
      quote.total,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote.total, quote.manual_total, quote.effectiveHours, quote.recommendation, equipmentId]);

  const tooHeavy = equipment ? weight > Number(equipment.capacity_kg) : false;
  const rec = quote.recommendation;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('equipment')}</label>
          <select value={equipmentId} onChange={e => setEquipmentId(e.target.value)} className="input-field">
            {pricing.equipment.map(e => <option key={e.id} value={e.id}>{e.name} — {formatCurrency(e.hourly_rate)}/soat</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('cargoWeight')} (kg)</label>
          <input type="number" min={0} value={weight} onChange={e => setWeight(Math.max(0, Number(e.target.value) || 0))} className={`input-field ${tooHeavy ? '!border-red-400 !ring-red-200' : ''}`} />
          {equipment && (
            <p className={`mt-1 text-xs ${tooHeavy ? 'text-red-500' : 'text-slate-400'}`}>
              Max {equipment.capacity_kg} kg, balandlik {equipment.max_height_m} m
            </p>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('heightFloor')}</label>
          <input type="number" min={1} max={40} value={floor} onChange={e => setFloor(Math.min(40, Math.max(1, Number(e.target.value) || 1)))} className="input-field" />
          <p className="mt-1 text-xs text-slate-400">≈ {height} m</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('hoursCount')}</label>
          <input type="number" min={0} value={hours} onChange={e => setHours(Math.max(0, Number(e.target.value) || 0))} className="input-field" />
          {equipment && Number(equipment.min_hours) > hours && <p className="mt-1 text-xs text-amber-500">{t('minHoursHint')}: {equipment.min_hours}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('km')}</label>
          <input type="number" min={0} value={km} onChange={e => setKm(Math.max(0, Number(e.target.value) || 0))} className="input-field" />
        </div>
      </div>

      {tooHeavy && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">{t('weightTooHeavy')}</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('craneTotal')}</p>
          <BreakdownList rows={quote.breakdown} total={quote.total} />
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <StatPill label={t('manualCost')} value={formatCurrency(quote.manual_total)} />
          </div>
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Scale className="h-4 w-4" /> {t('compare')}
            </p>
            <div className={`flex items-start gap-3 rounded-lg p-3 ${rec === 'kran' ? 'bg-emerald-50 dark:bg-emerald-900/20' : rec === 'manual' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
              {rec === 'kran' && <TrendingDown className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />}
              {rec === 'manual' && <TrendingUp className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />}
              {rec === 'equal' && <Scale className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400" />}
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {rec === 'kran' && t('cheaperKran').replace('{amount}', formatCurrency(quote.difference, ''))}
                {rec === 'manual' && t('cheaperManual').replace('{amount}', formatCurrency(quote.difference, ''))}
                {rec === 'equal' && t('samePrice')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
