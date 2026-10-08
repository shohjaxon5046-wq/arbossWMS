import { useState } from 'react';
import { Plus, Trash2, ClipboardList, Loader2, Send, Ban, PackageCheck, Search, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { generateDocNumber, inboundErrorKey, orderTotals } from '@/lib/inbound';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/format';
import { EmptyState } from '@/components/ui/States';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { InlineNotice, FieldLabel, type Notice } from '@/components/inbound/InlineNotice';
import type { InboundData, PurchaseOrder } from '@/types';
import type { TranslationKey } from '@/lib/i18n';

interface Props {
  data: InboundData;
  canManage: boolean;
  reload: () => Promise<void>;
  onGoToReceiving: () => void;
}

type LineDraft = { model_id: string; quantity: string; unit_price: string };
const emptyLine: LineDraft = { model_id: '', quantity: '1', unit_price: '' };

export function PurchaseOrdersTab({ data, canManage, reload, onGoToReceiving }: Props) {
  const { t } = useApp();
  const { staff } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', expected_date: '', notes: '' });
  const [lines, setLines] = useState<LineDraft[]>([emptyLine]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PurchaseOrder | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const supplierName = (id: string) => data.suppliers.find(s => s.id === id)?.name ?? '—';
  const modelName = (id: string) => data.models.find(m => m.id === id)?.name ?? '—';
  const detail = data.orders.find(o => o.id === detailId) ?? null;

  const openCreate = () => {
    setForm({ supplier_id: data.suppliers[0]?.id ?? '', expected_date: '', notes: '' });
    setLines([{ ...emptyLine }]);
    setFormError('');
    setCreateOpen(true);
  };

  const updateLine = (idx: number, patch: Partial<LineDraft>) =>
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const create = async () => {
    const valid = lines
      .map(l => ({ model_id: l.model_id, quantity_ordered: Math.floor(Number(l.quantity)), unit_price: Math.max(0, Number(l.unit_price) || 0) }))
      .filter(l => l.model_id && l.quantity_ordered > 0);
    if (!form.supplier_id || valid.length === 0) { setFormError(t('linesRequired')); return; }
    setSaving(true);
    const { data: po, error } = await supabase.from('erp_purchase_orders').insert({
      po_number: generateDocNumber('KB'),
      supplier_id: form.supplier_id,
      expected_date: form.expected_date || null,
      notes: form.notes.trim(),
      created_by: staff?.full_name ?? '',
    }).select('id').maybeSingle();
    if (error || !po) { setSaving(false); setFormError(t(inboundErrorKey(error))); return; }
    const { error: linesError } = await supabase.from('erp_purchase_order_lines').insert(valid.map(l => ({ ...l, purchase_order_id: po.id })));
    if (linesError) {
      await supabase.from('erp_purchase_orders').delete().eq('id', po.id);
      setSaving(false);
      setFormError(t(inboundErrorKey(linesError)));
      return;
    }
    setSaving(false);
    setCreateOpen(false);
    await reload();
    setDetailId(po.id);
  };

  const setStatus = async (o: PurchaseOrder, status: 'yuborildi' | 'bekor') => {
    const { error } = await supabase.from('erp_purchase_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', o.id);
    if (error) { setNotice({ kind: 'error', text: t(inboundErrorKey(error)) }); return; }
    await reload();
  };

  const filtered = data.orders.filter(o => {
    const q = search.toLowerCase();
    const matches = !q || o.po_number.toLowerCase().includes(q) || supplierName(o.supplier_id).toLowerCase().includes(q);
    return matches && (statusFilter === 'all' || o.status === statusFilter);
  });

  const draftTotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);
  const statuses: TranslationKey[] = ['yangi', 'yuborildi', 'qisman_qabul', 'qabul_qilindi', 'bekor'];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`${t('poNumber')}, ${t('supplier').toLowerCase()}`} className="input-field pl-9" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field sm:w-56">
          <option value="all">{t('allStatuses')}</option>
          {statuses.map(s => <option key={s} value={s}>{t(s)}</option>)}
        </select>
        {canManage && (
          <button onClick={openCreate} disabled={data.suppliers.length === 0} title={data.suppliers.length === 0 ? t('addSupplierFirst') : undefined} className="btn-primary">
            <Plus className="h-4 w-4" /> {t('newPurchaseOrder')}
          </button>
        )}
      </div>
      {canManage && data.suppliers.length === 0 && <p className="text-xs text-amber-600 dark:text-amber-400">{t('addSupplierFirst')}</p>}
      <InlineNotice notice={notice} onClose={() => setNotice(null)} />

      {filtered.length === 0 ? (
        <div className="card"><EmptyState icon={<ClipboardList className="h-12 w-12 text-slate-300 dark:text-slate-600" />} title={t('noPurchaseOrders')} /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="table-header">{t('poNumber')}</th>
                  <th className="table-header">{t('supplier')}</th>
                  <th className="table-header">{t('received')}</th>
                  <th className="table-header">{t('orderSum')}</th>
                  <th className="table-header">{t('expectedDate')}</th>
                  <th className="table-header">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(o => {
                  const tot = orderTotals(o);
                  const pct = tot.ordered ? Math.round((tot.received / tot.ordered) * 100) : 0;
                  return (
                    <tr key={o.id} onClick={() => setDetailId(o.id)} className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="table-cell font-mono text-xs font-semibold">{o.po_number}</td>
                      <td className="table-cell">{supplierName(o.supplier_id)}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-500">{tot.received}/{tot.ordered}</span>
                        </div>
                      </td>
                      <td className="table-cell whitespace-nowrap">{formatCurrency(tot.sum)}</td>
                      <td className="table-cell whitespace-nowrap">{formatDate(o.expected_date)}</td>
                      <td className="table-cell"><span className={`badge ${getStatusColor(o.status)}`}>{t(o.status as TranslationKey)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('newPurchaseOrder')} size="lg">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>{t('supplier')} *</FieldLabel>
              <select value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })} className="input-field">
                {data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>{t('expectedDate')}</FieldLabel>
              <input type="date" value={form.expected_date} onChange={e => setForm({ ...form, expected_date: e.target.value })} className="input-field" />
            </div>
          </div>

          <div>
            <FieldLabel>{t('orderLines')} *</FieldLabel>
            <div className="space-y-2">
              {lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_72px_auto] gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-800 sm:grid-cols-[1fr_88px_128px_auto]">
                  <select value={l.model_id} onChange={e => updateLine(idx, { model_id: e.target.value })} className="input-field col-span-3 sm:col-span-1">
                    <option value="">{t('selectModel')}</option>
                    {data.models.filter(m => m.is_active).map(m => <option key={m.id} value={m.id}>{m.name}{m.brand ? ` (${m.brand})` : ''}</option>)}
                  </select>
                  <input type="number" min={1} value={l.quantity} onChange={e => updateLine(idx, { quantity: e.target.value })} className="input-field" placeholder={t('quantity')} aria-label={t('quantity')} />
                  <input type="number" min={0} value={l.unit_price} onChange={e => updateLine(idx, { unit_price: e.target.value })} className="input-field" placeholder={t('unitPrice')} aria-label={t('unitPrice')} />
                  <button onClick={() => setLines(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)} disabled={lines.length === 1} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-900/20">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button onClick={() => setLines(prev => [...prev, { ...emptyLine }])} className="btn-ghost px-2 py-1.5 text-blue-600 dark:text-blue-400"><Plus className="h-4 w-4" /> {t('addLine')}</button>
              <p className="text-sm text-slate-500">{t('orderSum')}: <b className="text-slate-900 dark:text-slate-100">{formatCurrency(draftTotal)}</b></p>
            </div>
          </div>

          <div><FieldLabel>{t('fieldNotes')}</FieldLabel><textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input-field" /></div>
          {formError && <InlineNotice notice={{ kind: 'error', text: formError }} onClose={() => setFormError('')} />}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setCreateOpen(false)} className="btn-ghost">{t('cancel')}</button>
            <button onClick={create} disabled={saving} className="btn-primary">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{t('save')}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetailId(null)} title={detail ? `${t('poNumber')}: ${detail.po_number}` : ''} size="lg">
        {detail && (() => {
          const tot = orderTotals(detail);
          const open = detail.status === 'yangi' || detail.status === 'yuborildi' || detail.status === 'qisman_qabul';
          return (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className={`badge ${getStatusColor(detail.status)}`}>{t(detail.status as TranslationKey)}</span>
                <span className="text-slate-600 dark:text-slate-300">{supplierName(detail.supplier_id)}</span>
                <span className="flex items-center gap-1.5 text-slate-500"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(detail.expected_date)}</span>
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="table-header">{t('fieldModel')}</th>
                      <th className="table-header text-right">{t('ordered')}</th>
                      <th className="table-header text-right">{t('received')}</th>
                      <th className="table-header text-right">{t('unitPrice')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {detail.erp_purchase_order_lines.map(l => (
                      <tr key={l.id}>
                        <td className="table-cell font-medium">{modelName(l.model_id)}</td>
                        <td className="table-cell text-right">{l.quantity_ordered}</td>
                        <td className={`table-cell text-right font-semibold ${l.quantity_received >= l.quantity_ordered ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{l.quantity_received}</td>
                        <td className="table-cell text-right whitespace-nowrap">{formatCurrency(Number(l.unit_price))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{tot.received}/{tot.ordered} {t('pcs')}</span>
                <span>{t('orderSum')}: <b>{formatCurrency(tot.sum)}</b></span>
              </div>
              {detail.notes && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">{detail.notes}</p>}
              {canManage && open && (
                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                  {tot.received === 0 && (
                    <button onClick={() => setCancelTarget(detail)} className="btn-ghost text-red-600 dark:text-red-400"><Ban className="h-4 w-4" /> {t('cancelOrder')}</button>
                  )}
                  {detail.status === 'yangi' && (
                    <button onClick={() => setStatus(detail, 'yuborildi')} className="btn-secondary"><Send className="h-4 w-4" /> {t('markSent')}</button>
                  )}
                  <button onClick={() => { setDetailId(null); onGoToReceiving(); }} className="btn-primary"><PackageCheck className="h-4 w-4" /> {t('receiveOrder')}</button>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={async () => { if (cancelTarget) await setStatus(cancelTarget, 'bekor'); setCancelTarget(null); setDetailId(null); }}
        title={t('cancelOrder')}
        message={t('cancelOrderConfirm')}
      />
    </div>
  );
}
