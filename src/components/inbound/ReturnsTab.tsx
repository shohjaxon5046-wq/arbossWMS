import { useState } from 'react';
import { Undo2, Plus, Loader2, Send, RefreshCw, Banknote, AlertTriangle, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { inboundErrorKey } from '@/lib/inbound';
import { formatDate, getStatusColor } from '@/lib/format';
import { EmptyState } from '@/components/ui/States';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { InlineNotice, FieldLabel, type Notice } from '@/components/inbound/InlineNotice';
import type { InboundData, ProductItem, SupplierReturn, SupplierReturnStatus } from '@/types';
import type { TranslationKey } from '@/lib/i18n';

interface Props {
  data: InboundData;
  canManage: boolean;
  reload: () => Promise<void>;
}

const RETURNABLE: ProductItem['status'][] = ['qaytarish_kutilmoqda', 'omborda_bosh', 'tamirda'];

export function ReturnsTab({ data, canManage, reload }: Props) {
  const { t } = useApp();
  const { staff } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ ret: SupplierReturn; status: SupplierReturnStatus } | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const modelName = (id: string) => data.models.find(m => m.id === id)?.name ?? '—';
  const supplierName = (id: string | null) => (id ? data.suppliers.find(s => s.id === id)?.name : null) ?? '—';
  const awaiting = data.items.filter(i => i.status === 'qaytarish_kutilmoqda');
  const candidates = data.items.filter(i => RETURNABLE.includes(i.status) && (!i.supplier_id || i.supplier_id === supplierId));
  const detail = data.returns.find(r => r.id === detailId) ?? null;

  const pickSupplier = (id: string) => {
    setSupplierId(id);
    setSelected(new Set(awaiting.filter(i => i.supplier_id === id).map(i => i.id)));
  };

  const openCreate = (preset?: ProductItem) => {
    const sid = preset?.supplier_id ?? awaiting.find(i => i.supplier_id)?.supplier_id ?? data.suppliers[0]?.id ?? '';
    pickSupplier(sid);
    if (preset) setSelected(new Set([preset.id]));
    setReason(preset?.defect_reason ?? '');
    setNotes('');
    setFormError('');
    setCreateOpen(true);
  };

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const create = async () => {
    if (!supplierId || selected.size === 0) { setFormError(t('selectItemsToReturn')); return; }
    if (!reason.trim()) { setFormError(t('returnReason')); return; }
    setSaving(true);
    const { data: id, error } = await supabase.rpc('erp_create_supplier_return', {
      p_supplier_id: supplierId,
      p_item_ids: [...selected],
      p_reason: reason.trim(),
      p_notes: notes.trim(),
      p_created_by: staff?.full_name ?? '',
    });
    setSaving(false);
    if (error) { setFormError(t(inboundErrorKey(error))); return; }
    setCreateOpen(false);
    await reload();
    if (typeof id === 'string') setDetailId(id);
  };

  const applyStatus = async () => {
    if (!pending) return;
    const { error } = await supabase.rpc('erp_set_return_status', { p_return_id: pending.ret.id, p_status: pending.status });
    setPending(null);
    if (error) { setNotice({ kind: 'error', text: t(inboundErrorKey(error)) }); return; }
    await reload();
  };

  const actionLabel: Record<string, TranslationKey> = { yuborildi: 'markReturnSent', almashtirildi: 'markReplaced', pul_qaytarildi: 'markRefunded' };

  return (
    <div className="space-y-6">
      <InlineNotice notice={notice} onClose={() => setNotice(null)} />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <AlertTriangle className="h-4 w-4 text-orange-500" /> {t('awaitingReturn')} ({awaiting.length})
          </h3>
          {canManage && (
            <button onClick={() => openCreate()} disabled={data.suppliers.length === 0} className="btn-primary"><Plus className="h-4 w-4" /> {t('newReturn')}</button>
          )}
        </div>
        {awaiting.length > 0 && (
          <div className="card divide-y divide-slate-100 dark:divide-slate-800">
            {awaiting.map(i => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{modelName(i.model_id)}</p>
                  <p className="text-xs text-slate-500">{supplierName(i.supplier_id)}{i.defect_reason ? ` · ${i.defect_reason}` : ''}</p>
                </div>
                <span className={`badge ${getStatusColor(i.status)}`}>{t(i.status as TranslationKey)}</span>
                {canManage && <button onClick={() => openCreate(i)} className="btn-ghost px-2 py-1.5 text-sm"><Undo2 className="h-4 w-4" /></button>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('tabReturns')}</h3>
        {data.returns.length === 0 ? (
          <div className="card"><EmptyState icon={<Undo2 className="h-12 w-12 text-slate-300 dark:text-slate-600" />} title={t('noReturns')} /></div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.returns.map(r => (
              <button key={r.id} onClick={() => setDetailId(r.id)} className="card card-hover p-5 text-left">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{r.return_number}</p>
                  <span className={`badge ${getStatusColor(r.status)}`}>{t(r.status as TranslationKey)}</span>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300"><Truck className="h-3.5 w-3.5 text-slate-400" /> {supplierName(r.supplier_id)}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{r.reason}</p>
                <div className="mt-3 flex justify-between text-xs text-slate-400">
                  <span>{r.erp_supplier_return_items?.length || 0} {t('pcs')}</span>
                  <span>{formatDate(r.created_at)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('newReturn')} size="lg">
        <div className="space-y-4">
          <div>
            <FieldLabel>{t('supplier')} *</FieldLabel>
            <select value={supplierId} onChange={e => pickSupplier(e.target.value)} className="input-field">
              {data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>{t('selectItemsToReturn')} ({selected.size})</FieldLabel>
            {candidates.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500 dark:bg-slate-800/50">{t('noReturnCandidates')}</p>
            ) : (
              <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {candidates.map(i => (
                  <label key={i.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{modelName(i.model_id)}</p>
                      <p className="truncate font-mono text-xs text-slate-500">{i.serial_number || '—'}{i.warehouse_location_shelf ? ` · ${i.warehouse_location_shelf}` : ''}</p>
                    </div>
                    <span className={`badge ${getStatusColor(i.status)}`}>{t(i.status as TranslationKey)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div><FieldLabel>{t('returnReason')} *</FieldLabel><input value={reason} onChange={e => setReason(e.target.value)} className="input-field" /></div>
          <div><FieldLabel>{t('fieldNotes')}</FieldLabel><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className="input-field" /></div>
          {formError && <InlineNotice notice={{ kind: 'error', text: formError }} onClose={() => setFormError('')} />}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setCreateOpen(false)} className="btn-ghost">{t('cancel')}</button>
            <button onClick={create} disabled={saving} className="btn-primary">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{t('save')}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetailId(null)} title={detail ? `${t('returnNumber')}: ${detail.return_number}` : ''} size="md">
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className={`badge ${getStatusColor(detail.status)}`}>{t(detail.status as TranslationKey)}</span>
              <span className="text-slate-600 dark:text-slate-300">{supplierName(detail.supplier_id)}</span>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-slate-500">{t('date')}</dt><dd>{formatDate(detail.created_at)}</dd></div>
              <div><dt className="text-xs text-slate-500">{t('yuborildi')}</dt><dd>{formatDate(detail.sent_at)}</dd></div>
            </dl>
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800/50 dark:text-slate-300"><b>{t('returnReason')}:</b> {detail.reason}{detail.notes ? <><br />{detail.notes}</> : null}</p>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{t('itemsInReturn')}</p>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {(detail.erp_supplier_return_items || []).map(ri => {
                  const item = data.items.find(i => i.id === ri.product_item_id);
                  return (
                    <li key={ri.product_item_id} className="flex justify-between gap-2 px-3 py-2 text-sm">
                      <span className="truncate">{item ? modelName(item.model_id) : '—'}</span>
                      <span className="font-mono text-xs text-slate-500">{item?.serial_number || '—'}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            {detail.status === 'yuborildi' && <p className="text-xs leading-relaxed text-slate-500">{t('replacedHint')}</p>}
            {canManage && (detail.status === 'yangi' || detail.status === 'yuborildi') && (
              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                {detail.status === 'yangi' ? (
                  <button onClick={() => setPending({ ret: detail, status: 'yuborildi' })} className="btn-primary"><Send className="h-4 w-4" /> {t('markReturnSent')}</button>
                ) : (
                  <>
                    <button onClick={() => setPending({ ret: detail, status: 'pul_qaytarildi' })} className="btn-secondary"><Banknote className="h-4 w-4" /> {t('markRefunded')}</button>
                    <button onClick={() => setPending({ ret: detail, status: 'almashtirildi' })} className="btn-primary"><RefreshCw className="h-4 w-4" /> {t('markReplaced')}</button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={applyStatus}
        title={pending ? t(actionLabel[pending.status]) : ''}
        message={pending ? `${pending.ret.return_number} — ${t(actionLabel[pending.status])}?` : ''}
      />
    </div>
  );
}
