import { useMemo, useState } from 'react';
import { PackageOpen, Loader2, MapPin, Truck, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { inboundErrorKey } from '@/lib/inbound';
import { formatDate } from '@/lib/format';
import { EmptyState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';
import { FieldLabel, InlineNotice, type Notice } from '@/components/inbound/InlineNotice';
import type { InboundData, ProductItem } from '@/types';

interface Props {
  data: InboundData;
  canManage: boolean;
  reload: () => Promise<void>;
}

type Entry = { serial: string; locationId: string };

export function PutawayTab({ data, canManage, reload }: Props) {
  const { t } = useApp();
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [bulkShelf, setBulkShelf] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState<Notice>(null);

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

  const open = (key: string) => {
    const group = groups.find(g => g.key === key);
    if (!group) return;
    const init: Record<string, Entry> = {};
    group.items.forEach(i => { init[i.id] = { serial: '', locationId: '' }; });
    setEntries(init);
    setBulkShelf('');
    setFormError('');
    setGroupKey(key);
  };

  const close = () => setGroupKey(null);

  const setEntry = (itemId: string, patch: Partial<Entry>) =>
    setEntries(prev => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));

  const applyBulkShelf = () => {
    if (!bulkShelf) return;
    setEntries(prev => {
      const next = { ...prev };
      for (const k of Object.keys(next)) next[k] = { ...next[k], locationId: bulkShelf };
      return next;
    });
  };

  const save = async () => {
    if (!activeGroup) return;
    const payload = activeGroup.items.map(i => ({
      item_id: i.id,
      serial: (entries[i.id]?.serial ?? '').trim(),
      location_id: entries[i.id]?.locationId ?? '',
    }));
    if (payload.some(p => !p.serial)) { setFormError(t('errSerialRequired')); return; }
    if (payload.some(p => !p.location_id)) { setFormError(t('selectShelf')); return; }
    setSaving(true);
    setFormError('');
    const { error } = await supabase.rpc('erp_putaway_batch', { p_entries: payload });
    setSaving(false);
    if (error) { setFormError(t(inboundErrorKey(error))); return; }
    setNotice({ kind: 'success', text: `${t('putawayDone')}: ${payload.length} ${t('pcs')}` });
    setGroupKey(null);
    await reload();
  };

  const activeLocations = data.locations.filter(l => l.is_active);

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

      <Modal open={!!activeGroup} onClose={close} title={t('putawayBatchTitle')} size="lg">
        {activeGroup && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{t('putawayBatchHint')}</p>

            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <FieldLabel>{t('shelf')} ({t('all')})</FieldLabel>
              <div className="flex gap-2">
                <select value={bulkShelf} onChange={e => setBulkShelf(e.target.value)} className="input-field font-mono">
                  <option value="">{t('selectShelf')}</option>
                  {activeLocations.map(l => <option key={l.id} value={l.id}>{l.code}</option>)}
                </select>
                <button onClick={applyBulkShelf} className="btn-secondary flex-shrink-0">{t('use')}</button>
              </div>
            </div>

            <div className="space-y-2">
              {activeGroup.items.map((i: ProductItem, idx: number) => {
                const e = entries[i.id];
                return (
                  <div key={i.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <span className="flex-shrink-0 text-xs font-bold text-slate-400">{idx + 1}</span>
                    <div className="w-52 flex-shrink-0">
                      <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-300">{modelName(i.model_id)}</p>
                    </div>
                    <input
                      value={e?.serial ?? ''}
                      onChange={ev => setEntry(i.id, { serial: ev.target.value })}
                      placeholder={t('putawaySerial')}
                      className="input-field font-mono"
                    />
                    <select value={e?.locationId ?? ''} onChange={ev => setEntry(i.id, { locationId: ev.target.value })} className="input-field w-40 font-mono">
                      <option value="">{t('putawayShelf')}</option>
                      {activeLocations.map(l => <option key={l.id} value={l.id}>{l.code}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>

            {formError && <InlineNotice notice={{ kind: 'error', text: formError }} onClose={() => setFormError('')} />}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={close} className="btn-ghost">{t('close')}</button>
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {t('putawayBatchSave')} ({activeGroup.items.length})
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
