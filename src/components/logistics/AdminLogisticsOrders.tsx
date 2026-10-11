import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Phone, Search, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatDateTime, getStatusColor } from '@/lib/format';
import { LoadingSpinner, ErrorState, EmptyState } from '@/components/ui/States';
import type { TranslationKey } from '@/lib/i18n';
import type { LogisticsOrder, LogisticsOrderHistory, LogisticsService } from '@/types/logistics';

const serviceLabelKey: Record<LogisticsService, TranslationKey> = {
  gruzchik: 'serviceGruzchik',
  kran: 'serviceKran',
  musir: 'serviceMusir',
};

const statuses: { value: string; labelKey: TranslationKey }[] = [
  { value: 'yangi', labelKey: 'status_yangi' },
  { value: 'jarayonda', labelKey: 'status_jarayonda' },
  { value: 'bajarildi', labelKey: 'status_bajarildi' },
  { value: 'bekor', labelKey: 'status_bekor' },
];

export function AdminLogisticsOrders() {
  const { t } = useApp();
  const [orders, setOrders] = useState<LogisticsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [seller, setSeller] = useState('all');
  const [service, setService] = useState('all');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('logistics_orders')
      .select('*').order('created_at', { ascending: false }).limit(1000);
    if (err) setError(err.message);
    else setOrders((data ?? []) as LogisticsOrder[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sellers = useMemo(() => Array.from(new Set(orders.map(o => o.seller_name).filter(Boolean))).sort(), [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(o => {
      if (q && !o.order_number.toLowerCase().includes(q) && !o.customer_name.toLowerCase().includes(q) && !o.customer_phone.includes(q)) return false;
      if (seller !== 'all' && o.seller_name !== seller) return false;
      if (service !== 'all' && o.service !== service) return false;
      if (status !== 'all' && o.status !== status) return false;
      if (from && o.created_at.slice(0, 10) < from) return false;
      if (to && o.created_at.slice(0, 10) > to) return false;
      return true;
    });
  }, [orders, search, seller, service, status, from, to]);

  const stats = useMemo(() => {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 3600 * 1000);
    const bySeller = new Map<string, { count: number; sum: number }>();
    for (const o of orders) {
      const cur = bySeller.get(o.seller_name || '—') ?? { count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += Number(o.estimated_price);
      bySeller.set(o.seller_name || '—', cur);
    }
    return {
      today: orders.filter(o => o.created_at.slice(0, 10) === today.toISOString().slice(0, 10)).length,
      week: orders.filter(o => new Date(o.created_at) >= weekAgo).length,
      bySeller: Array.from(bySeller.entries()).map(([name, v]) => ({ name, ...v })),
    };
  }, [orders]);

  if (loading) return <LoadingSpinner text={t('loading')} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-900/20">
          <p className="text-xs text-blue-600 dark:text-blue-300">{t('statsToday')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-200">{stats.today}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-900/20">
          <p className="text-xs text-emerald-600 dark:text-emerald-300">{t('statsWeek')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-200">{stats.week}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="input-field pl-9" />
          </div>
          <select value={seller} onChange={e => setSeller(e.target.value)} className="input-field">
            <option value="all">{t('filterSeller')}: {t('all')}</option>
            {sellers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={service} onChange={e => setService(e.target.value)} className="input-field">
            <option value="all">{t('filterService')}: {t('all')}</option>
            {(['gruzchik', 'kran', 'musir'] as LogisticsService[]).map(s => <option key={s} value={s}>{t(serviceLabelKey[s])}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className="input-field">
            <option value="all">{t('filterStatus')}: {t('all')}</option>
            {statuses.map(s => <option key={s.value} value={s.value}>{t(s.labelKey)}</option>)}
          </select>
          <div>
            <label className="mb-1 block text-xs text-slate-400">{t('filterDateFrom')}</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">{t('filterDateTo')}</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input-field" />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold">{t('orderNum')}</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold">{t('filterService')}</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold">{t('customer')}</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold">{t('estimatedSum')}</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold">{t('status')}</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold">{t('createdBy')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">{t('noOrders')}</td></tr>
              )}
              {filtered.map(o => (
                <tr key={o.id} onClick={() => setDetailId(o.id)} className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-3 py-3">
                    <p className="font-mono text-sm font-semibold">{o.order_number}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(o.created_at)}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{t(serviceLabelKey[o.service])}</td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{o.customer_name}</p>
                    {o.customer_phone && <p className="text-xs text-slate-400">{o.customer_phone}</p>}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatCurrency(o.estimated_price)}</td>
                  <td className="px-3 py-3"><span className={`badge ${getStatusColor(o.status)}`}>{t(`status_${o.status}` as TranslationKey)}</span></td>
                  <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{o.seller_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{t('perSeller')}</p>
        <div className="space-y-1.5">
          {stats.bySeller.map(s => (
            <div key={s.name} className="flex items-center justify-between text-sm">
              <span className="text-slate-700 dark:text-slate-200">{s.name}</span>
              <span className="tabular-nums text-slate-500 dark:text-slate-400">{s.count} · {formatCurrency(s.sum)}</span>
            </div>
          ))}
        </div>
      </div>

      <LogisticsOrderDetail orderId={detailId} onClose={() => setDetailId(null)} onChanged={load} />
    </div>
  );
}

function LogisticsOrderDetail({ orderId, onClose, onChanged }: { orderId: string | null; onClose: () => void; onChanged: () => void }) {
  const { t } = useApp();
  const [order, setOrder] = useState<LogisticsOrder | null>(null);
  const [history, setHistory] = useState<LogisticsOrderHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [changing, setChanging] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setActionError('');
    const [{ data: o, error: oe }, { data: h, error: he }] = await Promise.all([
      supabase.from('logistics_orders').select('*').eq('id', orderId).maybeSingle(),
      supabase.from('logistics_order_history').select('*').eq('order_id', orderId).order('changed_at', { ascending: false }),
    ]);
    if (!oe) setOrder(o as LogisticsOrder | null);
    if (!he) setHistory((h ?? []) as LogisticsOrderHistory[]);
    setLoading(false);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  if (!orderId) return null;

  const changeStatus = async (newStatus: string) => {
    setChanging(true);
    setActionError('');
    const { error } = await supabase.rpc('logistics_set_status', { p_order_id: orderId, p_new_status: newStatus });
    if (error) setActionError(error.message);
    setChanging(false);
    await load();
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t('loOrderDetail')}</h3>
            <p className="font-mono text-sm text-slate-500">{order?.order_number}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>

        {actionError && (
          <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {actionError}
          </div>
        )}

        {loading ? <LoadingSpinner /> : order && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{t(serviceLabelKey[order.service])}</span>
              <span className={`badge ${getStatusColor(order.status)}`}>{t(`status_${order.status}` as TranslationKey)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-slate-400">{t('customer')}</p><p className="font-medium">{order.customer_name}</p></div>
              <div><p className="text-xs text-slate-400">{t('estimatedSum')}</p><p className="font-semibold tabular-nums">{formatCurrency(order.estimated_price)}</p></div>
              <div><p className="text-xs text-slate-400">{t('phone')}</p>
                {order.customer_phone && <a href={`tel:${order.customer_phone}`} className="flex items-center gap-1 text-blue-600">{order.customer_phone} <Phone className="h-3 w-3" /></a>}
              </div>
              <div><p className="text-xs text-slate-400">{t('createdBy')}</p><p>{order.seller_name || '—'}</p></div>
            </div>
            <div>
              <p className="text-xs text-slate-400">{t('loAddress')}</p>
              <p className="text-sm">{order.address || '—'}</p>
            </div>
            {order.datetime && <div><p className="text-xs text-slate-400">{t('loDateTime')}</p><p className="text-sm">{formatDateTime(order.datetime)}</p></div>}
            {order.note && <div><p className="text-xs text-slate-400">{t('loNote')}</p><p className="text-sm">{order.note}</p></div>}

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase text-slate-400">{t('orderDetails')}</p>
              <pre className="max-h-40 overflow-auto rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">{JSON.stringify(order.details, null, 2)}</pre>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-semibold">{t('changeStatus')}</p>
              <div className="flex flex-wrap gap-2">
                {statuses.filter(s => s.value !== order.status).map(s => (
                  <button key={s.value} disabled={changing} onClick={() => changeStatus(s.value)} className="btn-ghost disabled:opacity-50">
                    {t(s.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-semibold">{t('statusHistory')}</p>
              <div className="space-y-2">
                {history.length === 0 && <p className="text-xs text-slate-400">{t('noData')}</p>}
                {history.map(h => (
                  <div key={h.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
                    <div>
                      <span className="text-slate-600 dark:text-slate-300">{t(`status_${h.old_status}` as TranslationKey)} → <b>{t(`status_${h.new_status}` as TranslationKey)}</b></span>
                      <p className="text-xs text-slate-400">{t('historyBy')}: {h.changer_name || h.changed_by}</p>
                    </div>
                    <span className="text-xs text-slate-400">{formatDateTime(h.changed_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
