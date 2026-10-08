import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Wrench } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency } from '@/lib/format';
import { ordersErrorKey } from '@/lib/orders';
import { FieldLabel } from '@/components/inbound/InlineNotice';
import type { MaintenanceKind, MaintenanceLog, ProductItem } from '@/types';

const KINDS: MaintenanceKind[] = ['inspection', 'repair', 'replacement'];
const KIND_TONE: Record<MaintenanceKind, string> = {
  inspection: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  repair: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  replacement: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const today = () => new Date().toISOString().slice(0, 10);

export function MaintenanceTab({ items, canEdit, onError }: { items: ProductItem[]; canEdit: boolean; onError: (msg: string) => void }) {
  const { t } = useApp();
  const [logs, setLogs] = useState<MaintenanceLog[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const emptyForm = { item_id: items[0]?.id ?? '', log_date: today(), kind: 'inspection' as MaintenanceKind, works: '', cost: '', master: '' };
  const [form, setForm] = useState(emptyForm);

  const itemIds = items.map(i => i.id).join(',');
  const load = useCallback(async () => {
    if (!itemIds) { setLogs([]); return; }
    const { data, error } = await supabase.from('erp_maintenance_logs').select('*').in('item_id', itemIds.split(',')).order('log_date', { ascending: false });
    if (error) { onError(t(ordersErrorKey(error))); setLogs([]); return; }
    setLogs((data ?? []) as MaintenanceLog[]);
  }, [itemIds, onError, t]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.item_id || !form.works.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('erp_maintenance_logs').insert({
      item_id: form.item_id, log_date: form.log_date || today(), kind: form.kind,
      works: form.works.trim(), cost: Math.max(0, Math.round(Number(form.cost) || 0)), master: form.master.trim(),
    });
    setSaving(false);
    if (error) { onError(t(ordersErrorKey(error))); return; }
    setAdding(false);
    setForm(emptyForm);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('erp_maintenance_logs').delete().eq('id', id);
    if (error) { onError(t(ordersErrorKey(error))); return; }
    setLogs(l => (l ?? []).filter(x => x.id !== id));
  };

  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500 dark:border-slate-700">{t('catUnitsEmpty')}</p>;
  }

  const serialOf = (id: string) => items.find(i => i.id === id)?.serial_number ?? '—';
  const totalCost = (logs ?? []).reduce((s, l) => s + Number(l.cost || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{t('catCost')}: <b className="text-slate-900 dark:text-slate-100">{formatCurrency(totalCost)}</b></span>
        {canEdit && !adding && <button type="button" onClick={() => setAdding(true)} className="btn-secondary text-sm"><Plus className="h-4 w-4" /> {t('catAddMaintenance')}</button>}
      </div>

      {adding && (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 animate-fade-in dark:border-blue-900 dark:bg-blue-900/10">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <FieldLabel>{t('catUnit')}</FieldLabel>
              <select value={form.item_id} onChange={e => setForm({ ...form, item_id: e.target.value })} className="input-field py-2 text-sm">
                {items.map(i => <option key={i.id} value={i.id}>{i.serial_number}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>{t('date')}</FieldLabel>
              <input type="date" value={form.log_date} onChange={e => setForm({ ...form, log_date: e.target.value })} className="input-field py-2 text-sm" />
            </div>
            <div>
              <FieldLabel>{t('catKind')}</FieldLabel>
              <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as MaintenanceKind })} className="input-field py-2 text-sm">
                {KINDS.map(k => <option key={k} value={k}>{t(`catKind_${k}` as const)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <FieldLabel>{t('catWorks')} *</FieldLabel>
            <input value={form.works} onChange={e => setForm({ ...form, works: e.target.value })} className="input-field py-2 text-sm" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>{t('catCost')}</FieldLabel>
              <input type="number" min={0} value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} className="input-field py-2 text-sm" />
            </div>
            <div>
              <FieldLabel>{t('catMaster')}</FieldLabel>
              <input value={form.master} onChange={e => setForm({ ...form, master: e.target.value })} className="input-field py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setAdding(false); setForm(emptyForm); }} className="btn-ghost text-sm">{t('cancel')}</button>
            <button type="button" onClick={save} disabled={saving || !form.works.trim()} className="btn-primary text-sm">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} {t('save')}
            </button>
          </div>
        </div>
      )}

      {logs === null ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <Wrench className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm text-slate-500">{t('catMaintenanceEmpty')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {logs.map(l => (
            <li key={l.id} className="group flex items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:border-slate-300 dark:border-slate-700">
              <div className="w-20 flex-shrink-0 text-xs text-slate-500">{l.log_date}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge ${KIND_TONE[l.kind]}`}>{t(`catKind_${l.kind}` as const)}</span>
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{serialOf(l.item_id)}</span>
                </div>
                <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{l.works}</p>
                {l.master && <p className="text-xs text-slate-400">{t('catMaster')}: {l.master}</p>}
              </div>
              <div className="text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(l.cost)}</div>
              {canEdit && (
                <button type="button" onClick={() => remove(l.id)} className="rounded-lg p-1.5 text-slate-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-900/20" aria-label={t('delete')}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
