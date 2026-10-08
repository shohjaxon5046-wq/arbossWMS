import { useMemo, useState } from 'react';
import { ImageOff, Package, Search } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency } from '@/lib/format';
import { modelImageUrl } from '@/lib/orders';
import { Modal } from '@/components/ui/Modal';
import type { ProductModel } from '@/types';

interface Props {
  open: boolean;
  models: ProductModel[];
  onClose: () => void;
  onPick: (model: ProductModel) => void;
}

export function ProductSearchModal({ open, models, onClose, onPick }: Props) {
  const { t } = useApp();
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return models.filter(m => {
      if (!m.is_active) return false;
      if (!q) return true;
      return [m.name, m.brand, m.category, m.model_code].some(v => (v ?? '').toLowerCase().includes(q));
    });
  }, [models, search]);

  return (
    <Modal open={open} onClose={onClose} title={t('searchProducts')} size="xl">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('search')}
            className="input-field pl-9"
          />
        </div>

        {visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400"><Package className="mx-auto mb-2 h-8 w-8" /> {t('noData')}</p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {visible.map(m => {
              const img = modelImageUrl(m.image_url);
              return (
                <button
                  key={m.id}
                  onClick={() => onPick(m)}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-700 dark:hover:border-blue-500 dark:hover:bg-blue-900/10"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                    {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <ImageOff className="h-4 w-4 text-slate-300" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{m.name}</p>
                    <p className="truncate text-xs text-slate-400">
                      {[m.brand, m.category, m.model_code].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(m.daily_price)}</p>
                    <p className="text-xs text-slate-400">{t('deposit')}: {formatCurrency(m.deposit_amount)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
