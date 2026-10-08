import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Package, Plus, Search, ShoppingCart, Wrench } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/format';
import { LoadingSpinner, ErrorState, EmptyState, PageHeader } from '@/components/ui/States';
import { CreateOrderModal } from '@/components/orders/CreateOrderModal';
import { OrderDetailModal } from '@/components/orders/OrderDetailModal';
import { InlineNotice, type Notice } from '@/components/inbound/InlineNotice';
import type { TranslationKey } from '@/lib/i18n';
import type { Order } from '@/types';

type OrderRow = Order & { erp_order_items: { count: number }[]; erp_service_orders: { count: number }[] };
type OrderType = 'rent' | 'service' | 'mixed';

const orderType = (o: OrderRow): OrderType => {
  const items = o.erp_order_items?.[0]?.count ?? 0;
  const services = o.erp_service_orders?.[0]?.count ?? 0;
  if (items && services) return 'mixed';
  return services ? 'service' : 'rent';
};

export function OrdersPage({ initialSearch }: { initialSearch?: string }) {
  const { t } = useApp();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(initialSearch ?? '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | OrderType>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const loadData = useCallback(async () => {
    const { data, error: err } = await supabase.from('erp_orders')
      .select('*, erp_order_items(count), erp_service_orders(count)')
      .order('created_at', { ascending: false }).limit(500);
    if (err) setError(err.message);
    else setOrders((data || []) as OrderRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter(o =>
      (!q || o.order_number.toLowerCase().includes(q) || o.customer_name.toLowerCase().includes(q) || o.customer_phone.includes(q)) &&
      (statusFilter === 'all' || o.status === statusFilter) &&
      (typeFilter === 'all' || orderType(o) === typeFilter));
  }, [orders, search, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const active = orders.filter(o => o.status !== 'yakunlandi' && o.status !== 'bekor');
    return {
      active: active.length,
      debt: orders.filter(o => o.status !== 'bekor').reduce((s, o) => s + Number(o.debt_amount), 0),
      today: orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).length,
    };
  }, [orders]);

  if (loading) return <LoadingSpinner text={t('loading')} />;
  if (error) return <ErrorState message={error} />;

  const statusOptions: { value: string; label: string }[] = [
    { value: 'all', label: t('all') },
    { value: 'yangi', label: t('pending') },
    { value: 'yigilmoqda', label: t('assembling') },
    { value: 'faol_ijarada', label: t('activeRental') },
    { value: 'kechikkan', label: t('overdue') },
    { value: 'yakunlandi', label: t('completed') },
    { value: 'bekor', label: t('cancelled') },
  ];

  const typeMeta: Record<OrderType, { label: string; cls: string; icon: typeof Package }> = {
    rent: { label: t('ordTypeRent'), cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: Package },
    service: { label: t('ordTypeService'), cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: Wrench },
    mixed: { label: t('ordTypeMixed'), cls: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300', icon: ShoppingCart },
  };

  const newButton = <button onClick={() => setCreateOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> {t('ordNew')}</button>;

  return (
    <div className="space-y-6">
      <PageHeader title={t('ordersTitle')} subtitle={t('ordersSubtitle')} action={newButton} />
      <InlineNotice notice={notice} onClose={() => setNotice(null)} />

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('activeRental'), value: String(stats.active) },
          { label: t('debt'), value: formatCurrency(stats.debt), tone: stats.debt > 0 ? 'text-red-600 dark:text-red-400' : '' },
          { label: t('today'), value: String(stats.today) },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100 ${s.tone ?? ''}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="input-field pl-9" />
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {(['all', 'rent', 'service', 'mixed'] as const).map(v => (
            <button key={v} onClick={() => setTypeFilter(v)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-all ${typeFilter === v
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
              {v === 'all' ? t('ordTypeAll') : typeMeta[v].label}
            </button>
          ))}
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field lg:w-48">
          {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<ShoppingCart className="h-12 w-12 text-slate-300 dark:text-slate-600" />} title={t('noData')} action={newButton} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="table-header">{t('orderNumber')}</th>
                  <th className="table-header">{t('customer')}</th>
                  <th className="table-header">{t('ordTypeAll')}</th>
                  <th className="table-header text-right">{t('ordGrandTotal')}</th>
                  <th className="table-header text-right">{t('debt')}</th>
                  <th className="table-header">{t('status')}</th>
                  <th className="table-header" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(o => {
                  const meta = typeMeta[orderType(o)];
                  const Icon = meta.icon;
                  return (
                    <tr key={o.id} onClick={() => setDetailId(o.id)} className="group cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="table-cell">
                        <p className="font-mono text-sm font-medium">{o.order_number}</p>
                        <p className="text-xs text-slate-400">{formatDate(o.created_at)}</p>
                      </td>
                      <td className="table-cell">
                        <p className="font-medium">{o.customer_name}</p>
                        <p className="text-xs text-slate-400">{o.customer_phone}</p>
                      </td>
                      <td className="table-cell">
                        <span className={`badge gap-1 ${meta.cls}`}><Icon className="h-3 w-3" /> {meta.label}</span>
                      </td>
                      <td className="table-cell text-right font-semibold tabular-nums">{formatCurrency(o.total_rent_amount)}</td>
                      <td className={`table-cell text-right tabular-nums ${Number(o.debt_amount) > 0 && o.status !== 'bekor' ? 'font-medium text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                        {formatCurrency(o.debt_amount)}
                      </td>
                      <td className="table-cell"><span className={`badge ${getStatusColor(o.status)}`}>{t(o.status as TranslationKey) || o.status}</span></td>
                      <td className="table-cell text-right">
                        <ChevronRight className="ml-auto h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CreateOrderModal open={createOpen} onClose={() => setCreateOpen(false)}
        onCreated={id => { setCreateOpen(false); setNotice({ kind: 'success', text: t('ordCreated') }); loadData(); setDetailId(id); }} />
      <OrderDetailModal orderId={detailId} onClose={() => setDetailId(null)} onChanged={loadData} />
    </div>
  );
}
