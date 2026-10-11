import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Package, Plus, Search, ShoppingCart, Wrench, User, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/format';
import { LoadingSpinner, ErrorState, EmptyState, PageHeader } from '@/components/ui/States';
import { CreateOrderModal } from '@/components/orders/CreateOrderModal';
import { OrderDetailModal } from '@/components/orders/OrderDetailModal';
import { InlineNotice, type Notice } from '@/components/inbound/InlineNotice';
import { AdminLogisticsPage } from '@/components/logistics/AdminLogisticsPage';
import { CreateLogisticsOrderModal } from '@/components/logistics/CreateLogisticsOrderModal';
import { Modal } from '@/components/ui/Modal';
import type { TranslationKey } from '@/lib/i18n';
import type { Order } from '@/types';
import type { LogisticsService } from '@/types/logistics';

type OrderRow = Order & { erp_order_items: { count: number }[]; erp_service_orders: { count: number }[] };
type OrderType = 'rent' | 'service' | 'mixed';
type MainTab = 'uskunalar' | 'logistika';

const orderType = (o: OrderRow): OrderType => {
  const items = o.erp_order_items?.[0]?.count ?? 0;
  const services = o.erp_service_orders?.[0]?.count ?? 0;
  if (items && services) return 'mixed';
  return services ? 'service' : 'rent';
};

export function OrdersPage({ initialSearch }: { initialSearch?: string }) {
  const { t } = useApp();
  const [activeTab, setActiveTab] = useState<MainTab>('uskunalar');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(initialSearch ?? '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | OrderType>('all');
  
  // Modals state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createUskunaOpen, setCreateUskunaOpen] = useState(false);
  const [createLogisticsOpen, setCreateLogisticsOpen] = useState<LogisticsService | null>(null);
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

  const newButton = <button onClick={() => setPickerOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> {t('ordNew')}</button>;

  const handlePick = (kind: 'uskuna' | LogisticsService) => {
    setPickerOpen(false);
    if (kind === 'uskuna') setCreateUskunaOpen(true);
    else {
      setActiveTab('logistika'); // switch to logistics tab so they see it created
      setCreateLogisticsOpen(kind);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('ordersTitle')} subtitle={t('ordersSubtitle')} action={newButton} />
      
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button onClick={() => setActiveTab('uskunalar')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'uskunalar' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
          📦 Uskuna ijarasi (Asosiy)
        </button>
        <button onClick={() => setActiveTab('logistika')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'logistika' ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
          🚚 Logistika va Xizmatlar
        </button>
      </div>

      <InlineNotice notice={notice} onClose={() => setNotice(null)} />

      {activeTab === 'uskunalar' ? (
        <>
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

          <div className="card p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="input-field pl-9" />
              </div>
              <div className="flex flex-wrap gap-2">
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as OrderType | 'all')} className="input-field max-w-[140px] text-sm">
                  <option value="all">{t('all')}</option>
                  <option value="rent">{t('ordTypeRent')}</option>
                  <option value="service">{t('ordTypeService')}</option>
                  <option value="mixed">{t('ordTypeMixed')}</option>
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field max-w-[140px] text-sm">
                  {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState icon={<ShoppingCart className="h-12 w-12 text-slate-300 dark:text-slate-600" />} title={t('ordEmpty')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-4 py-3 font-medium text-slate-500">{t('orderNumber')}</th>
                      <th className="px-4 py-3 font-medium text-slate-500">{t('customer')}</th>
                      <th className="px-4 py-3 font-medium text-slate-500">{t('total')} / {t('debt')}</th>
                      <th className="px-4 py-3 font-medium text-slate-500">{t('date')}</th>
                      <th className="px-4 py-3 font-medium text-slate-500">{t('status')}</th>
                      <th className="w-10 px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filtered.map(o => {
                      const TypeIcon = typeMeta[orderType(o)].icon;
                      return (
                        <tr key={o.id} onClick={() => setDetailId(o.id)} className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`flex h-6 w-6 items-center justify-center rounded-md ${typeMeta[orderType(o)].cls}`} title={typeMeta[orderType(o)].label}>
                                <TypeIcon className="h-3.5 w-3.5" />
                              </span>
                              <span className="font-mono font-medium text-slate-900 dark:text-slate-100">{o.order_number}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900 dark:text-slate-100">{o.customer_name}</p>
                            <p className="text-xs text-slate-500">{o.customer_phone}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(o.total_rent_amount + o.total_service_amount)}</p>
                            {o.debt_amount > 0 && <p className="text-xs font-medium text-red-600 dark:text-red-400">{t('debt')}: {formatCurrency(o.debt_amount)}</p>}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                            {formatDate(o.created_at)}
                            <p className="text-xs text-slate-400">Xodim: {o.created_by}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`badge ${getStatusColor(o.status)}`}>{t(o.status as TranslationKey)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <ChevronRight className="inline-block h-4 w-4 text-slate-400" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <AdminLogisticsPage />
      )}

      {/* Type Picker Modal */}
      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Qanday buyurtma yaratmoqchisiz?" size="md">
        <div className="grid grid-cols-2 gap-3 pb-4">
          <button onClick={() => handlePick('uskuna')} className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-blue-900/20">
            <Package className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Uskuna ijarasi</span>
          </button>
          <button onClick={() => handlePick('musir')} className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-amber-300 hover:bg-amber-50 dark:border-slate-700 dark:hover:border-amber-700 dark:hover:bg-amber-900/20">
            <Wrench className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Musor olib ketish</span>
          </button>
          <button onClick={() => handlePick('kran')} className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-teal-300 hover:bg-teal-50 dark:border-slate-700 dark:hover:border-teal-700 dark:hover:bg-teal-900/20">
            <Truck className="h-8 w-8 text-teal-600 dark:text-teal-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Kran xizmati</span>
          </button>
          <button onClick={() => handlePick('gruzchik')} className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-purple-300 hover:bg-purple-50 dark:border-slate-700 dark:hover:border-purple-700 dark:hover:bg-purple-900/20">
            <User className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Yuk tashuvchi</span>
          </button>
        </div>
      </Modal>

      {createUskunaOpen && (
        <CreateOrderModal 
          open={createUskunaOpen} 
          onClose={() => setCreateUskunaOpen(false)} 
          onCreated={(id) => { setCreateUskunaOpen(false); loadData(); setDetailId(id); }} 
        />
      )}
      
      {createLogisticsOpen && (
        <CreateLogisticsOrderModal 
          open={!!createLogisticsOpen} 
          initialService={createLogisticsOpen} 
          onClose={() => setCreateLogisticsOpen(null)} 
          onCreated={() => { setCreateLogisticsOpen(null); setActiveTab('logistika'); }} 
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
