import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { calculateGruzchik, type SelectionMap } from '@/lib/logistics';
import { BreakdownList, StatPill } from '@/components/logistics/Common';
import type { LogisticsPricingData } from '@/types/logistics';

interface Props {
  pricing: LogisticsPricingData;
  onChange: (details: Record<string, unknown>, price: number) => void;
}

export function GruzchikCalculator({ pricing, onChange }: Props) {
  const { t } = useApp();
  const [selection, setSelection] = useState<SelectionMap>({});
  const [floor, setFloor] = useState(1);
  const [liftId, setLiftId] = useState('');
  const [distance, setDistance] = useState(0);

  const cargo = pricing.cargo_items;
  const lift = pricing.lift_types.find(l => l.id === liftId);

  const quote = useMemo(
    () => calculateGruzchik(cargo, selection, floor, lift, distance, pricing.loader_settings, pricing.floor_pricing),
    [cargo, selection, floor, lift, distance, pricing.loader_settings, pricing.floor_pricing],
  );

  useEffect(() => {
    if (quote.total_weight === 0 && Object.keys(selection).length === 0) return;
    onChange(
      {
        service: 'gruzchik',
        cargo: cargo.filter(c => (selection[c.id] ?? 0) > 0).map(c => ({ id: c.id, name: c.name, qty: selection[c.id], weight_kg: c.weight_kg, price: c.price })),
        floor,
        lift: lift?.name ?? '',
        distance,
      },
      quote.total,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote.total, quote.total_weight, quote.workers, floor, liftId, distance, JSON.stringify(selection)]);

  const setQty = (id: string, qty: number) => {
    const next = { ...selection, [id]: Math.max(0, qty) };
    if (next[id] === 0) delete next[id];
    setSelection(next);
  };

  const anySelected = cargo.some(c => (selection[c.id] ?? 0) > 0);

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('cargoItems')}</p>
        <div className="space-y-2">
          {cargo.map(c => {
            const qty = selection[c.id] ?? 0;
            return (
              <div key={c.id} className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${qty > 0 ? 'border-blue-300 bg-blue-50/60 dark:border-blue-700 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-700'}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.weight_kg} kg · {c.price} so'm/{c.unit}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setQty(c.id, qty - 1)} disabled={qty === 0}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">{qty}</span>
                  <button onClick={() => setQty(c.id, qty + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('etaj')}</label>
          <input type="number" min={1} max={30} value={floor} onChange={e => setFloor(Math.min(30, Math.max(1, Number(e.target.value) || 1)))} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('liftType')}</label>
          <select value={liftId} onChange={e => setLiftId(e.target.value)} className="input-field">
            <option value="">—</option>
            {pricing.lift_types.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('distanceM')}</label>
          <input type="number" min={0} value={distance} onChange={e => setDistance(Math.max(0, Number(e.target.value) || 0))} className="input-field" />
        </div>
      </div>

      {anySelected && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <StatPill label={t('totalWeight')} value={`${quote.total_weight} kg`} />
            <StatPill label={t('workersNeeded')} value={quote.workers} sub={t('workers')} />
            <StatPill label={t('timeEstimate')} value={`${quote.time_hours} ${t('hoursShort')}`} />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('priceBreakdown')}</p>
            <BreakdownList rows={quote.breakdown} total={quote.total} />
          </div>
        </div>
      )}
    </div>
  );
}
