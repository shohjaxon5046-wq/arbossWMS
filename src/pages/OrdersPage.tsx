import { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Search, ChevronRight, Package, ShoppingCart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/format';
import { LoadingSpinner, ErrorState, EmptyState, PageHeader } from '@/components/ui/States';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { OrderDetailModal } from '@/components/orders/OrderDetailModal';
import { CreateOrderModal } from '@/components/orders/CreateOrderModal';
import type { Order, OrderStatus } from '@/types';
import type { TranslationKey } from '@/lib/i18n';

export function OrdersPage({ initialSearch }: { initialSearch?: string }) {
  const { t } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(initialSearch ?? '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const [createUskunaOpen, setCreateUskunaOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from('erp_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) setError(err.message);
      else setOrders((data || []) as Order[]);
    } catch (e: any) {
      setError(e?.message || 'Yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return orders.filter(o =>
      (!q || o.order_number.toLowerCase().includes(q) || o.customer_name.toLowerCase().includes(q) || o.customer_phone.includes(q)) &&
      (statusFilter === 'all' || o.status === statusFilter)
    );
  }, [orders, search, statusFilter]);

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

  const newButton = (
    <button onClick={() => setCreateUskunaOpen(true)} className="btn-primary">
      <Plus className="h-4 w-4" /> {t('ordNew')}
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t('ordersTitle')} subtitle={t('ordersSubtitle')} action={newButton} />

      <InlineNotice notice={notice} onClose={() => setNotice(null)} />

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('activeRental'), value: String(stats.active) },
          { label: t('debt'), value: formatCurrency(stats.debt), tone: stats.debt > 0 ? 'text-red-600' : '' },
          { label: t('today'), value: String(stats.today) },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums text-slate-900 ${s.tone ?? ''}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters and Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('search')}
              className="input-field pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="input-field max-w-[160px] text-sm"
            >
              {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart className="h-12 w-12 text-slate-300" />}
            title={t('ordEmpty')}
            action={newButton}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider">{t('orderNumber')}</th>
                  <th className="px-4 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider">{t('customer')}</th>
                  <th className="px-4 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider">{t('total')} / {t('debt')}</th>
                  <th className="px-4 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider">{t('date')}</th>
                  <th className="px-4 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider">{t('status')}</th>
                  <th className="w-10 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(o => (
                  <tr
                    key={o.id}
                    onClick={() => setDetailId(o.id)}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                          <Package className="h-3.5 w-3.5" />
                        </span>
                        <span className="font-mono font-medium text-slate-900">{o.order_number}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{o.customer_name}</p>
                      <p className="text-xs text-slate-500">{o.customer_phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{formatCurrency(o.total_rent_amount)}</p>
                      {o.debt_amount > 0 && (
                        <p className="text-xs font-medium text-red-600">
                          {t('debt')}: {formatCurrency(o.debt_amount)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(o.created_at)}
                      <p className="text-xs text-slate-400">Xodim: {o.created_by}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${getStatusColor(o.status)}`}>
                        {t(o.status as TranslationKey)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="inline-block h-4 w-4 text-slate-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createUskunaOpen && (
        <CreateOrderModal 
          open={createUskunaOpen} 
          onClose={() => setCreateUskunaOpen(false)} 
          onCreated={(id) => { setCreateUskunaOpen(false); loadData(); setDetailId(id); }} 
        />
      )}
      
      {detailId && (
        <OrderDetailModal 
          orderId={detailId} 
          onClose={() => setDetailId(null)} 
          onChanged={loadData} 
        />
      )}
    </div>
  );
}
