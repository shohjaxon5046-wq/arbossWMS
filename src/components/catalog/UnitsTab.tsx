import { useState } from 'react';
import { Loader2, Printer, QrCode } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, getStatusColor } from '@/lib/format';
import { ordersErrorKey, residualValue } from '@/lib/orders';
import { unitLabels } from '@/components/catalog/modelForm';
import type { Label } from '@/lib/labels';
import type { ProductItem, ProductModel } from '@/types';

interface Props {
  model: ProductModel;
  items: ProductItem[];
  canEditPct: boolean;
  onItemChanged: (item: ProductItem) => void;
  onPrint: (labels: Label[]) => void;
  onError: (msg: string) => void;
}

export function UnitsTab({ model, items, canEditPct, onItemChanged, onPrint, onError }: Props) {
  const { t } = useApp();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const savePct = async (item: ProductItem) => {
    const raw = drafts[item.id];
    if (raw === undefined) return;
    const next = raw.trim() === '' ? null : Math.min(100, Math.max(0, Number(raw) || 0));
    if (next === item.depreciation_pct) return;
    setSavingId(item.id);
    const { data, error } = await supabase.from('erp_product_items').update({ depreciation_pct: next }).eq('id', item.id).select().maybeSingle();
    setSavingId(null);
    if (error || !data) { onError(t(ordersErrorKey(error))); return; }
    onItemChanged(data as ProductItem);
    setDrafts(d => { const rest = { ...d }; delete rest[item.id]; return rest; });
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 text-center dark:border-slate-700">
        <QrCode className="h-10 w-10 text-slate-300 dark:text-slate-600" />
        <p className="mt-3 max-w-sm text-sm text-slate-500">{t('catUnitsEmpty')}</p>
      </div>
    );
  }

  const totals = items.reduce((a, i) => ({ cost: a.cost + Number(i.purchase_price || 0), revenue: a.revenue + Number(i.revenue_total || 0), residual: a.residual + residualValue(i) }), { cost: 0, revenue: 0, residual: 0 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-slate-500">{t('catUnitsTotal')}: <b className="text-slate-900 dark:text-slate-100">{items.length}</b></span>
          <span className="text-slate-500">{t('catRevenue')}: <b className="text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.revenue)}</b></span>
          <span className="text-slate-500">{t('catResidual')}: <b className="text-slate-900 dark:text-slate-100">{formatCurrency(totals.residual)}</b></span>
        </div>
        <button type="button" onClick={() => onPrint(unitLabels(model, items))} className="btn-secondary text-sm"><Printer className="h-4 w-4" /> {t('catPrintAll')}</button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60">
            <tr>
              {[t('catSerial'), t('catShelf'), t('status'), t('catCost'), t('catRents'), t('catRentDays'), t('catRevenue'), t('catRoi'), t('catResidual'), t('catUnitPct'), ''].map((h, i) => (
                <th key={i} className={`px-3 py-2.5 font-medium ${i >= 3 && i <= 9 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map(i => {
              const cost = Number(i.purchase_price || 0);
              const revenue = Number(i.revenue_total || 0);
              const residual = residualValue(i);
              const roi = cost > 0 ? Math.round((revenue / cost) * 100) : null;
              return (
                <tr key={i.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-3 py-2.5 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">{i.serial_number}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-300">{i.warehouse_location_shelf || '—'}</td>
                  <td className="px-3 py-2.5"><span className={`badge ${getStatusColor(i.status)}`}>{t(i.status as never) || i.status}</span></td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(cost)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{i.rental_count || 0}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{i.rental_days_total || 0}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(revenue)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {roi === null ? '—' : <span className={`font-semibold ${roi >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>{roi}%</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {cost > 0 && residual === 0 ? <span className="badge bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">{t('catWornOut')}</span> : formatCurrency(residual)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      {savingId === i.id && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
                      <input
                        type="number" min={0} max={100} disabled={!canEditPct}
                        value={drafts[i.id] ?? (i.depreciation_pct ?? '')}
                        onChange={e => setDrafts(d => ({ ...d, [i.id]: e.target.value }))}
                        onBlur={() => savePct(i)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        placeholder={String(model.depreciation_pct)}
                        title={t('catUnitPctHint')}
                        className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-right text-xs focus:border-blue-500 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button type="button" onClick={() => onPrint(unitLabels(model, [i]))} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800" aria-label={t('catSticker')} title={t('catSticker')}>
                      <QrCode className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">{t('catUnitPctHint')}</p>
    </div>
  );
}
