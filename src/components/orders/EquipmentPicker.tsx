import { useMemo, useState } from 'react';
import { ChevronDown, ImageOff, Plus, ScanLine, Search, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency } from '@/lib/format';
import { QrScanner } from '@/components/inbound/QrScanner';
import { modelImageUrl, parseScan, rentDiscountPct, rentLineTotal } from '@/lib/orders';
import type { ProductItem, ProductModel } from '@/types';

interface Props {
  models: ProductModel[];
  available: ProductItem[];
  selectedIds: string[];
  days: number;
  onAdd: (item: ProductItem) => void;
  onRemove: (itemId: string) => void;
}

export function EquipmentPicker({ models, available, selectedIds, days, onAdd, onRemove }: Props) {
  const { t } = useApp();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState('');

  const freeByModel = useMemo(() => {
    const map = new Map<string, ProductItem[]>();
    for (const i of available) {
      if (selectedIds.includes(i.id)) continue;
      map.set(i.model_id, [...(map.get(i.model_id) ?? []), i]);
    }
    return map;
  }, [available, selectedIds]);

  const modelById = useMemo(() => new Map(models.map(m => [m.id, m])), [models]);

  const visibleModels = models.filter(m => {
    if (!m.is_active) return false;
    const q = search.trim().toLowerCase();
    return !q || [m.name, m.brand, m.category, m.model_code].some(v => (v || '').toLowerCase().includes(q));
  });

  const selectedItems = selectedIds
    .map(id => available.find(i => i.id === id))
    .filter((i): i is ProductItem => !!i);

  const handleScan = (raw: string) => {
    const scan = parseScan(raw);
    let item: ProductItem | undefined;
    if (scan.kind === 'item') {
      const serial = scan.serial.toUpperCase();
      item = available.find(i => !selectedIds.includes(i.id) && (i.serial_number.toUpperCase() === serial || i.barcode.toUpperCase() === serial));
    } else {
      const model = models.find(m => m.id === scan.code || (m.model_code && m.model_code.toUpperCase() === scan.code.toUpperCase()));
      item = model ? freeByModel.get(model.id)?.[0] : undefined;
    }
    if (!item) { setScanError(t('errScanNotFound')); return; }
    setScanError('');
    onAdd(item);
    setScanOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="input-field pl-9" />
        </div>
        <button onClick={() => { setScanError(''); setScanOpen(true); }} className="btn-secondary whitespace-nowrap">
          <ScanLine className="h-4 w-4" /> <span className="hidden sm:inline">{t('ordScanItem')}</span>
        </button>
      </div>

      <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {visibleModels.length === 0 && <p className="py-6 text-center text-sm text-slate-400">{t('noData')}</p>}
        {visibleModels.map(m => {
          const free = freeByModel.get(m.id) ?? [];
          const isOpen = expanded === m.id;
          const img = modelImageUrl(m.image_url);
          return (
            <div key={m.id} className="rounded-xl border border-slate-200 transition-colors dark:border-slate-700">
              <div className="flex items-center gap-3 p-2">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                  {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <ImageOff className="h-4 w-4 text-slate-300" />}
                </div>
                <button onClick={() => setExpanded(isOpen ? null : m.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{m.name}</p>
                  <p className="text-xs text-slate-400">
                    {formatCurrency(m.daily_price)} / {t('ordPerDay')} ·{' '}
                    <span className={free.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>{free.length} {t('ordAvailable')}</span>
                  </p>
                </button>
                {free.length > 0 && (
                  <button onClick={() => setExpanded(isOpen ? null : m.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                )}
                <button onClick={() => free[0] && onAdd(free[0])} disabled={!free.length}
                  className="btn-primary !px-3 !py-1.5 text-xs disabled:opacity-40">
                  <Plus className="h-3.5 w-3.5" /> {t('ordAddUnit')}
                </button>
              </div>
              {isOpen && free.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-slate-100 p-2 dark:border-slate-800">
                  {free.map(i => (
                    <button key={i.id} onClick={() => onAdd(i)}
                      className="rounded-md border border-slate-200 px-2 py-1 font-mono text-xs text-slate-600 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-blue-900/20">
                      {i.serial_number}{i.warehouse_location_shelf && <span className="ml-1 text-slate-400">· {i.warehouse_location_shelf}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedItems.length > 0 && (
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('ordSelectedUnits')} ({selectedItems.length})</p>
          <div className="space-y-1.5">
            {selectedItems.map(i => {
              const m = modelById.get(i.model_id);
              const disc = m ? rentDiscountPct(m, days) : 0;
              return (
                <div key={i.id} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm shadow-sm animate-fade-in dark:bg-slate-900">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m?.name}</p>
                    <p className="font-mono text-xs text-slate-400">{i.serial_number}</p>
                  </div>
                  {disc > 0 && <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">−{disc}%</span>}
                  <span className="font-semibold tabular-nums">{m ? formatCurrency(rentLineTotal(m, days)) : '—'}</span>
                  <button onClick={() => onRemove(i.id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <QrScanner open={scanOpen} onClose={() => setScanOpen(false)} onResult={handleScan} error={scanError} />
    </div>
  );
}
