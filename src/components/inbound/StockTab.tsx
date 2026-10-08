import { useState } from 'react';
import { Search, Boxes, ArrowDownToLine, Wrench, MoveRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { inboundErrorKey } from '@/lib/inbound';
import { getStatusColor } from '@/lib/format';
import { EmptyState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';
import { ShelfPicker } from '@/components/inbound/ShelfPicker';
import { InlineNotice, type Notice } from '@/components/inbound/InlineNotice';
import type { InboundData, ProductItem, ProductItemStatus } from '@/types';
import type { TranslationKey } from '@/lib/i18n';

interface Props {
  data: InboundData;
  canManage: boolean;
  reload: () => Promise<void>;
  initialSearch?: string;
}

const STATUS_OPTIONS: ProductItemStatus[] = [
  'omborda_bosh', 'ijarada', 'tamirda', 'joylashtirish_kutilmoqda', 'qaytarish_kutilmoqda', 'qaytarilmoqda', 'qaytarildi', 'yoqolgan', 'sotildi',
];

const iconBtn = 'rounded-lg p-1.5 text-slate-400 transition-colors';

export function StockTab({ data, canManage, reload, initialSearch = '' }: Props) {
  const { t } = useApp();
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState('all');
  const [shelfFilter, setShelfFilter] = useState('all');
  const [moveTarget, setMoveTarget] = useState<ProductItem | null>(null);
  const [moveLocation, setMoveLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const modelName = (id: string) => data.models.find(m => m.id === id)?.name ?? '—';
  const supplierName = (id: string | null) => (id ? data.suppliers.find(s => s.id === id)?.name : null) ?? '—';

  const update = async (item: ProductItem, patch: Partial<ProductItem>) => {
    const { error } = await supabase.from('erp_product_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', item.id);
    if (error) { setNotice({ kind: 'error', text: t(inboundErrorKey(error)) }); return false; }
    await reload();
    return true;
  };

  const confirmMove = async () => {
    if (!moveTarget || !moveLocation) return;
    const loc = data.locations.find(l => l.id === moveLocation);
    if (!loc) return;
    setSaving(true);
    const ok = await update(moveTarget, { warehouse_location_id: loc.id, warehouse_location_shelf: loc.code });
    setSaving(false);
    if (ok) setMoveTarget(null);
  };

  const filtered = data.items.filter(i => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || i.serial_number.toLowerCase().includes(q) || i.barcode.toLowerCase().includes(q)
      || modelName(i.model_id).toLowerCase().includes(q) || i.warehouse_location_shelf.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
    const matchesShelf = shelfFilter === 'all' || i.warehouse_location_id === shelfFilter;
    return matchesSearch && matchesStatus && matchesShelf;
  });

  const counts = [
    { label: t('totalUnits'), value: data.items.length, color: 'text-slate-700 dark:text-slate-200' },
    { label: t('inWarehouse'), value: data.items.filter(i => i.status === 'omborda_bosh').length, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: t('rented'), value: data.items.filter(i => i.status === 'ijarada').length, color: 'text-blue-600 dark:text-blue-400' },
    { label: t('repair'), value: data.items.filter(i => i.status === 'tamirda').length, color: 'text-amber-600 dark:text-amber-400' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {counts.map(c => (
          <div key={c.label} className="card p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">{c.label}</p>
            <p className={`mt-1 text-2xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`${t('serialNumber')}, ${t('fieldModel').toLowerCase()}, ${t('shelf').toLowerCase()}`} className="input-field pl-9" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field sm:w-56">
          <option value="all">{t('allStatuses')}</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{t(s as TranslationKey)}</option>)}
        </select>
        <select value={shelfFilter} onChange={e => setShelfFilter(e.target.value)} className="input-field font-mono sm:w-44">
          <option value="all">{t('allShelves')}</option>
          {data.locations.map(l => <option key={l.id} value={l.id}>{l.code}</option>)}
        </select>
      </div>
      <InlineNotice notice={notice} onClose={() => setNotice(null)} />

      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<Boxes className="h-12 w-12 text-slate-300 dark:text-slate-600" />} title={t('noStock')} /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="table-header">{t('fieldModel')}</th>
                  <th className="table-header">{t('serialNumber')}</th>
                  <th className="table-header">{t('shelf')}</th>
                  <th className="table-header">{t('supplier')}</th>
                  <th className="table-header">{t('status')}</th>
                  {canManage && <th className="table-header text-right">{t('actions')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(item => (
                  <tr key={item.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="table-cell font-medium">{modelName(item.model_id)}</td>
                    <td className="table-cell font-mono text-xs">{item.serial_number || '—'}</td>
                    <td className="table-cell font-mono text-xs">{item.warehouse_location_shelf || '—'}</td>
                    <td className="table-cell text-slate-500">{supplierName(item.supplier_id)}</td>
                    <td className="table-cell"><span className={`badge ${getStatusColor(item.status)}`}>{t(item.status as TranslationKey)}</span></td>
                    {canManage && (
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1">
                          {item.status === 'omborda_bosh' && (
                            <>
                              <button onClick={() => { setMoveTarget(item); setMoveLocation(item.warehouse_location_id ?? ''); }} title={t('moveShelf')} className={`${iconBtn} hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20`}>
                                <MoveRight className="h-4 w-4" />
                              </button>
                              <button onClick={() => update(item, { status: 'tamirda' })} title={t('repair')} className={`${iconBtn} hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/20`}>
                                <Wrench className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {(item.status === 'ijarada' || item.status === 'tamirda') && (
                            <button onClick={() => update(item, { status: 'omborda_bosh', current_order_id: null })} title={t('returnToWarehouse')} className={`${iconBtn} hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20`}>
                              <ArrowDownToLine className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!moveTarget} onClose={() => setMoveTarget(null)} title={t('moveShelf')} size="sm">
        {moveTarget && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
              <p className="font-medium text-slate-900 dark:text-slate-100">{modelName(moveTarget.model_id)}</p>
              <p className="font-mono text-xs text-slate-500">{moveTarget.serial_number} · {moveTarget.warehouse_location_shelf || '—'}</p>
            </div>
            <ShelfPicker locations={data.locations} value={moveLocation} onChange={setMoveLocation} />
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setMoveTarget(null)} className="btn-ghost">{t('cancel')}</button>
              <button onClick={confirmMove} disabled={saving || !moveLocation} className="btn-primary">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{t('save')}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
