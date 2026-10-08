import { useEffect, useState } from 'react';
import { Printer, Trash2, Loader2, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { inboundErrorKey, SHELF_QR_PREFIX } from '@/lib/inbound';
import { qrSvg } from '@/lib/labels';
import { getStatusColor } from '@/lib/format';
import { Modal } from '@/components/ui/Modal';
import { InlineNotice, FieldLabel } from '@/components/inbound/InlineNotice';
import type { ProductItem, ProductModel, WarehouseLocation } from '@/types';
import type { TranslationKey } from '@/lib/i18n';

interface Props {
  location: WarehouseLocation | null;
  items: ProductItem[];
  models: ProductModel[];
  canManage: boolean;
  onClose: () => void;
  onPrint: (location: WarehouseLocation) => void;
  onDelete: (location: WarehouseLocation) => void;
  onSaved: () => Promise<void>;
}

export function ShelfDetailModal({ location, items, models, canManage, onClose, onPrint, onDelete, onSaved }: Props) {
  const { t } = useApp();
  const [qr, setQr] = useState('');
  const [form, setForm] = useState({ description: '', capacity: '0', is_active: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!location) return;
    setForm({ description: location.description ?? '', capacity: String(location.capacity), is_active: location.is_active });
    setError('');
    let cancelled = false;
    qrSvg(SHELF_QR_PREFIX + location.code).then(svg => {
      if (!cancelled) setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    });
    return () => { cancelled = true; };
  }, [location]);

  if (!location) return null;
  const onShelf = items.filter(i => i.warehouse_location_id === location.id);
  const modelName = (id: string) => models.find(m => m.id === id)?.name ?? '—';

  const save = async () => {
    setSaving(true);
    const { error: err } = await supabase.from('erp_warehouse_locations').update({
      description: form.description.trim(),
      capacity: Math.max(0, Math.floor(Number(form.capacity) || 0)),
      is_active: form.is_active,
    }).eq('id', location.id);
    setSaving(false);
    if (err) { setError(t(inboundErrorKey(err))); return; }
    await onSaved();
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`${t('shelf')} ${location.code}`} size="lg">
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700">
            {qr ? <img src={qr} alt={location.code} className="h-40 w-40" /> : <div className="h-40 w-40 animate-pulse rounded bg-slate-100" />}
          </div>
          <p className="font-mono text-lg font-bold tracking-wider text-slate-900 dark:text-slate-100">{location.code}</p>
          <button onClick={() => onPrint(location)} className="btn-secondary w-full"><Printer className="h-4 w-4" /> {t('print')}</button>
        </div>

        <div className="space-y-5">
          {canManage && (
            <div className="space-y-3">
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <div><FieldLabel>{t('capacity')}</FieldLabel><input type="number" min={0} value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className="input-field" /></div>
                <div><FieldLabel>{t('description')}</FieldLabel><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" /></div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                {t('shelfActive')}
              </label>
              {error && <InlineNotice notice={{ kind: 'error', text: error }} onClose={() => setError('')} />}
              <div className="flex justify-between gap-2">
                <button onClick={() => onDelete(location)} disabled={onShelf.length > 0} title={onShelf.length > 0 ? t('errInUse') : undefined} className="btn-ghost text-red-600 disabled:opacity-40 dark:text-red-400">
                  <Trash2 className="h-4 w-4" /> {t('delete')}
                </button>
                <button onClick={save} disabled={saving} className="btn-primary">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{t('save')}</button>
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{t('shelfContents')} ({onShelf.length}{location.capacity > 0 ? ` / ${location.capacity}` : ''})</p>
            {onShelf.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg bg-slate-50 py-6 text-sm text-slate-500 dark:bg-slate-800/50">
                <Package className="h-8 w-8 text-slate-300 dark:text-slate-600" /> {t('emptyShelf')}
              </div>
            ) : (
              <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {onShelf.map(i => (
                  <li key={i.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">{modelName(i.model_id)}</p>
                      <p className="font-mono text-xs text-slate-500">{i.serial_number || '—'}</p>
                    </div>
                    <span className={`badge ${getStatusColor(i.status)}`}>{t(i.status as TranslationKey)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
