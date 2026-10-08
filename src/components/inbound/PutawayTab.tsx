import { useMemo, useRef, useState } from 'react';
import { PackageOpen, Loader2, MapPin, Truck, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { inboundErrorKey } from '@/lib/inbound';
import { formatDate } from '@/lib/format';
import { EmptyState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';
import { ShelfPicker } from '@/components/inbound/ShelfPicker';
import { InlineNotice, FieldLabel, type Notice } from '@/components/inbound/InlineNotice';
import type { InboundData } from '@/types';

interface Props {
  data: InboundData;
  canManage: boolean;
  reload: () => Promise<void>;
}

export function PutawayTab({ data, canManage, reload }: Props) {
  const { t } = useApp();
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [serial, setSerial] = useState('');
  const [locationId, setLocationId] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [doneCount, setDoneCount] = useState(0);
  const [notice, setNotice] = useState<Notice>(null);
  const serialRef = useRef<HTMLInputElement>(null);

  const modelName = (id: string) => data.models.find(m => m.id === id)?.name ?? '—';
  const supplierName = (id: string | null) => (id ? data.suppliers.find(s => s.id === id)?.name : null) ?? '—';
  const poNumber = (id: string | null) => (id ? data.orders.find(o => o.id === id)?.po_number : null) ?? '';

  const groups = useMemo(() => {
    const map = new Map<string, typeof data.items>();
    data.items.filter(i => i.status === 'joylashtirish_kutilmoqda').forEach(i => {
      const key = `${i.model_id}|${i.purchase_order_id ?? ''}`;
      map.set(key, [...(map.get(key) ?? []), i]);
    });
    return [...map.entries()].map(([key, items]) => ({ key, items }));
  }, [data]);

  const activeGroup = groups.find(g => g.key === groupKey);
  const current = activeGroup?.items[0] ?? null;

  const open = (key: string) => {
    setGroupKey(key);
    setSerial('');
    setFormError('');
    setDoneCount(0);
  };

  const close = () => {
    if (doneCount > 0) setNotice({ kind: 'success', text: `${t('putawayDone')}: ${doneCount} ${t('pcs')}` });
    setGroupKey(null);
  };

  const save = async () => {
    if (!current) return;
    const value = serial.trim();
    if (!value) { setFormError(t('errSerialRequired')); return; }
    if (!locationId) { setFormError(t('selectShelf')); return; }
    if (data.items.some(i => i.id !== current.id && i.serial_number.toLowerCase() === value.toLowerCase())) {
      setFormError(t('errDuplicateSerial'));
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc('erp_putaway_item', { p_item_id: current.id, p_serial: value, p_location_id: locationId });
    setSaving(false);
    if (error) { setFormError(t(inboundErrorKey(error))); return; }
    setDoneCount(c => c + 1);
    setSerial('');
    setFormError('');
    await reload();
    serialRef.current?.focus();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('awaitingPutaway')}</h3>
      <InlineNotice notice={notice} onClose={() => setNotice(null)} />
      {groups.length === 0 ? (
        <div className="card"><EmptyState icon={<PackageOpen className="h-12 w-12 text-slate-300 dark:text-slate-600" />} title={t('noAwaitingPutaway')} /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map(g => {
            const first = g.items[0];
            return (
              <div key={g.key} className="card card-hover flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{modelName(first.model_id)}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><Truck className="h-3.5 w-3.5" /> {supplierName(first.supplier_id)}</p>
                    {poNumber(first.purchase_order_id) && <p className="mt-0.5 font-mono text-xs text-slate-400">{poNumber(first.purchase_order_id)}</p>}
                  </div>
                  <span className="flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                    <span className="text-lg font-bold leading-none">{g.items.length}</span>
                    <span className="text-[10px]">{t('pcs')}</span>
                  </span>
                </div>
                <p className="mt-3 flex-1 text-xs text-slate-400">{formatDate(first.created_at)}</p>
                {canManage && (
                  <button onClick={() => open(g.key)} className="btn-primary mt-4 w-full">
                    <MapPin className="h-4 w-4" /> {t('putaway')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!groupKey} onClose={close} title={t('putawayTitle')} size="md">
        {current ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{modelName(current.model_id)}</p>
                <p className="text-xs text-slate-500">{supplierName(current.supplier_id)}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>{t('remaining')}</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{activeGroup?.items.length ?? 0}</p>
              </div>
            </div>
            {doneCount > 0 && (
              <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /> {t('putawayDone')}: {doneCount} {t('pcs')}</p>
            )}
            <div>
              <FieldLabel>{t('serialNumber')} *</FieldLabel>
              <input
                ref={serialRef}
                autoFocus
                value={serial}
                onChange={e => setSerial(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
                placeholder={t('enterSerial')}
                className="input-field font-mono"
              />
            </div>
            <ShelfPicker locations={data.locations} value={locationId} onChange={setLocationId} />
            {formError && <InlineNotice notice={{ kind: 'error', text: formError }} onClose={() => setFormError('')} />}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={close} className="btn-ghost">{t('close')}</button>
              <button onClick={save} disabled={saving} className="btn-primary">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{t('putawayNext')}</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="font-medium text-slate-900 dark:text-slate-100">{t('putawayDone')}: {doneCount} {t('pcs')}</p>
            <button onClick={close} className="btn-primary">{t('close')}</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
