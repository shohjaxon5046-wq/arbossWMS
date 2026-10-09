import { useState } from 'react';
import { PackageCheck, Loader2, ArrowRight, Truck, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { inboundErrorKey, orderTotals } from '@/lib/inbound';
import { formatDate, getStatusColor } from '@/lib/format';
import { EmptyState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';
import { InlineNotice, type Notice } from '@/components/inbound/InlineNotice';
import type { InboundData, PurchaseOrder } from '@/types';
import type { TranslationKey } from '@/lib/i18n';

interface Props {
  data: InboundData;
  canManage: boolean;
  reload: () => Promise<void>;
  onGoToPutaway: () => void;
}

type Entry = { good: string; defective: string; reason: string };

const clampInt = (v: string, max: number) => Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));

export function ReceivingTab({ data, canManage, reload, onGoToPutaway }: Props) {
  const { t } = useApp();
  const [active, setActive] = useState<PurchaseOrder | null>(null);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [lastReceived, setLastReceived] = useState(0);
  const [editPo, setEditPo] = useState<PurchaseOrder | null>(null);

  const openOrders = data.orders.filter(o => o.status === 'yangi' || o.status === 'yuborildi' || o.status === 'qisman_qabul');
  const completedOrders = data.orders.filter(o => o.status === 'qabul_qilindi');
  
  const supplierName = (id: string) => data.suppliers.find(s => s.id === id)?.name ?? '—';
  const modelName = (id: string) => data.models.find(m => m.id === id)?.name ?? '—';


  const start = (o: PurchaseOrder) => {
    const init: Record<string, Entry> = {};
    o.erp_purchase_order_lines.forEach(l => {
      init[l.id] = { good: String(l.quantity_ordered - l.quantity_received), defective: '0', reason: '' };
    });
    setEntries(init);
    setFormError('');
    setActive(o);
  };

  const setEntry = (lineId: string, patch: Partial<Entry>) => setEntries(prev => ({ ...prev, [lineId]: { ...prev[lineId], ...patch } }));

  const submit = async () => {
    if (!active) return;
    const payload = active.erp_purchase_order_lines.map(l => {
      const remaining = l.quantity_ordered - l.quantity_received;
      const e = entries[l.id];
      const good = clampInt(e?.good ?? '0', remaining);
      const defective = clampInt(e?.defective ?? '0', remaining - good);
      return { line_id: l.id, good, defective, reason: e?.reason.trim() ?? '' };
    });
    const total = payload.reduce((s, p) => s + p.good + p.defective, 0);
    if (total === 0) { setFormError(t('errNothing')); return; }
    setSaving(true);
    const { error } = await supabase.rpc('erp_receive_purchase', { p_po_id: active.id, p_lines: payload });
    setSaving(false);
    if (error) { setFormError(t(inboundErrorKey(error))); return; }
    setActive(null);
    setLastReceived(payload.reduce((s, p) => s + p.good, 0));
    setNotice({ kind: 'success', text: `${active.po_number}: ${total} ${t('pcs')}` });
    await reload();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('openOrdersToReceive')}</h3>
      <InlineNotice notice={notice} onClose={() => setNotice(null)} />
      {notice?.kind === 'success' && lastReceived > 0 && (
        <button onClick={onGoToPutaway} className="btn-secondary w-full sm:w-auto">{t('putaway')} ({lastReceived} {t('pcs')}) <ArrowRight className="h-4 w-4" /></button>
      )}

      {openOrders.length === 0 ? (
        <div className="card"><EmptyState icon={<PackageCheck className="h-12 w-12 text-slate-300 dark:text-slate-600" />} title={t('noOpenOrders')} /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {openOrders.map(o => {
            const tot = orderTotals(o);
            return (
              <div key={o.id} className="card card-hover flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{o.po_number}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300"><Truck className="h-3.5 w-3.5 text-slate-400" /> {supplierName(o.supplier_id)}</p>
                  </div>
                  <span className={`badge ${getStatusColor(o.status)}`}>{t(o.status as TranslationKey)}</span>
                </div>
                <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                  {o.erp_purchase_order_lines.map(l => (
                    <li key={l.id} className="flex justify-between gap-2">
                      <span className="truncate text-slate-600 dark:text-slate-300">{modelName(l.model_id)}</span>
                      <span className="flex-shrink-0 text-slate-500">{l.quantity_received}/{l.quantity_ordered}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(o.expected_date)}</span>
                  {canManage && (
                    <button onClick={() => start(o)} className="btn-primary px-3 py-2">
                      <PackageCheck className="h-4 w-4" /> {t('receiveOrder')} ({tot.ordered - tot.received})
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!active} onClose={() => setActive(null)} title={active ? `${t('receiveOrder')}: ${active.po_number}` : ''} size="lg">
        {active && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{t('receiveHint')}</p>
            {active.erp_purchase_order_lines.filter(l => l.quantity_received < l.quantity_ordered).map(l => {
              const remaining = l.quantity_ordered - l.quantity_received;
              const e = entries[l.id];
              const sum = (Number(e?.good) || 0) + (Number(e?.defective) || 0);
              const over = sum > remaining;
              return (
                <div key={l.id} className={`rounded-xl border p-4 transition-colors ${over ? 'border-red-300 dark:border-red-800' : 'border-slate-200 dark:border-slate-800'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{modelName(l.model_id)}</p>
                    <span className="text-xs text-slate-500">{t('remaining')}: <b>{remaining}</b> {t('pcs')}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-emerald-700 dark:text-emerald-400">{t('good')}</span>
                      <input type="number" min={0} max={remaining} value={e?.good ?? ''} onChange={ev => setEntry(l.id, { good: ev.target.value })} className="input-field" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-orange-700 dark:text-orange-400">{t('defective')}</span>
                      <input type="number" min={0} max={remaining} value={e?.defective ?? ''} onChange={ev => setEntry(l.id, { defective: ev.target.value })} className="input-field" />
                    </label>
                  </div>
                  {Number(e?.defective) > 0 && (
                    <input value={e?.reason ?? ''} onChange={ev => setEntry(l.id, { reason: ev.target.value })} placeholder={t('defectReason')} className="input-field mt-3" />
                  )}
                  {over && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{t('errTooMany')}</p>}
                </div>
              );
            })}
            {formError && <InlineNotice notice={{ kind: 'error', text: formError }} onClose={() => setFormError('')} />}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setActive(null)} className="btn-ghost">{t('cancel')}</button>
              <button onClick={submit} disabled={saving} className="btn-primary">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{t('confirmReceive')}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Completed Orders Section */}
      {completedOrders.length > 0 && (
        <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Avval qabul qilinganlar (Eski qabullar)</h3>
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-500">{t('ordNumber')}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t('supplier')}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t('date')}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t('status')}</th>
                  <th className="w-10 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {completedOrders.map(o => (
                  <tr key={o.id} onClick={() => setEditPo(o)} className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-slate-100">{o.po_number}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-1.5"><Truck className="h-4 w-4 text-slate-400" /> {supplierName(o.supplier_id)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(o.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${getStatusColor(o.status)}`}>{t(o.status as TranslationKey)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ArrowRight className="inline-block h-4 w-4 text-slate-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editPo && (
        <EditReceiptModal
          po={editPo}
          modelName={modelName}
          onClose={() => setEditPo(null)}
          onChange={reload}
        />
      )}
    </div>
  );
}

function EditReceiptModal({ po, modelName, onClose, onChange }: { po: PurchaseOrder; modelName: (id: string) => string; onClose: () => void; onChange: () => Promise<void> }) {
  const { t } = useApp();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.from('erp_product_items').select('*').eq('purchase_order_id', po.id).order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setItems(data || []);
    setLoading(false);
  }, [po.id]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleDelete = async (itemId: string, serial: string) => {
    if (!window.confirm(`Rostdan ham ushbu uskunani qabuldan olib tashlamoqchimisiz?\nSeriya raqami: ${serial}`)) return;
    setDeletingId(itemId);
    setError('');
    const { error: err } = await supabase.rpc('erp_delete_received_item', { p_item_id: itemId });
    setDeletingId(null);
    if (err) {
      setError(err.message.includes('ITEM_IN_USE') ? 'Uskuna ijarada yoki omborda emas, o\'chirib bo\'lmaydi.' : 'Xatolik yuz berdi: ' + err.message);
      return;
    }
    await loadItems();
    await onChange();
  };

  return (
    <Modal open={true} onClose={onClose} title={`${t('receiveOrder')} tahrirlash: ${po.po_number}`} size="lg">
      <div className="space-y-4">
        {error && <InlineNotice notice={{ kind: 'error', text: error }} onClose={() => setError('')} />}
        
        {loading ? (
          <div className="py-8"><Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<PackageCheck className="h-10 w-10 text-slate-300" />} title="Qabul qilingan uskunalar yo'q" />
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{modelName(item.model_id)}</p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">SN: {item.serial_number}</p>
                </div>
                <button
                  onClick={() => handleDelete(item.id, item.serial_number)}
                  disabled={deletingId === item.id}
                  className="rounded-lg p-2 text-red-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20"
                  title="Qabuldan olib tashlash"
                >
                  {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="btn-primary">Yopish</button>
        </div>
      </div>
    </Modal>
  );
}
