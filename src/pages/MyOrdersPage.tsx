import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/format';
import { LoadingSpinner, ErrorState, EmptyState, PageHeader } from '@/components/ui/States';
import type { TranslationKey } from '@/lib/i18n';

interface OrderStat {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  customer_name: string;
  total_rent_amount: number;
}

export function MyOrdersPage() {
  const { t } = useApp();
  const { staff } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<OrderStat[]>([]);
  const [rate, setRate] = useState(5);
  const [dateRange, setDateRange] = useState<'today' | 'month' | 'all'>('month');

  useEffect(() => {
    if (staff?.user_id) load();
  }, [staff?.user_id]);

  async function load() {
    setLoading(true);
    try {
      const [settingsRes, ordersRes] = await Promise.all([
        supabase.from('erp_settings').select('value').eq('key', 'commission_rates').maybeSingle(),
        supabase.from('erp_orders').select(`
          id, order_number, status, created_at, customer_name, total_rent_amount
        `).eq('created_by_user_id', staff!.user_id).order('created_at', { ascending: false })
      ]);

      if (ordersRes.error) throw ordersRes.error;
      
      const r = settingsRes.data?.value as any;
      setRate(r?.uskuna || 5);
      setOrders((ordersRes.data || []) as any[]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = useMemo(() => {
    const now = new Date();
    return orders.filter(o => {
      if (dateRange === 'all') return true;
      const d = new Date(o.created_at);
      if (dateRange === 'today') {
        return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      if (dateRange === 'month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [orders, dateRange]);

  const stats = useMemo(() => {
    let rentBonus = 0;
    let totalSales = 0;
    let validCount = 0;

    for (const o of filteredOrders) {
      if (o.status === 'bekor') continue; // Do not calculate bonus for cancelled orders
      validCount++;
      const rent = Number(o.total_rent_amount) || 0;
      totalSales += rent;
      rentBonus += rent * (rate / 100);
    }
    return { rentBonus, totalSales, validCount };
  }, [filteredOrders, rate]);

  if (loading) return <LoadingSpinner text={t('loading')} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Mening profilim va savdolarim" subtitle="O'zingiz yaratgan ijara buyurtmalari va ishlab topgan bonuslaringiz" />

      <div className="flex gap-2">
        <button onClick={() => setDateRange('today')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateRange === 'today' ? 'bg-blue-600 text-white font-semibold' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>Bugun</button>
        <button onClick={() => setDateRange('month')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateRange === 'month' ? 'bg-blue-600 text-white font-semibold' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>Shu oy</button>
        <button onClick={() => setDateRange('all')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateRange === 'all' ? 'bg-blue-600 text-white font-semibold' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>Barcha vaqt</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm border-t-4 border-t-emerald-500">
          <p className="text-xs font-medium text-slate-500">Jami bonus ({rate}% toza daromad)</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(stats.rentBonus)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm border-t-4 border-t-blue-500">
          <p className="text-xs font-medium text-slate-500">Jami ijara summasi</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(stats.totalSales)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm border-t-4 border-t-indigo-500">
          <p className="text-xs font-medium text-slate-500">Faol buyurtmalar soni</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.validCount} ta</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between bg-slate-50">
          <h3 className="font-semibold text-sm text-slate-900">Buyurtmalar ro'yxati</h3>
          <span className="text-xs text-slate-500">Bekor qilingan buyurtmalar bonusga kirmaydi</span>
        </div>
        {filteredOrders.length === 0 ? (
          <EmptyState title="Buyurtmalar yo'q" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Buyurtma</th>
                  <th className="px-4 py-3 text-left">Sana</th>
                  <th className="px-4 py-3 text-left">Mijoz</th>
                  <th className="px-4 py-3 text-right">Ijara summasi</th>
                  <th className="px-4 py-3 text-center">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map(o => {
                  const isCancelled = o.status === 'bekor';
                  return (
                    <tr key={o.id} className={`transition-colors hover:bg-slate-50 ${isCancelled ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 font-mono font-medium text-slate-900">{o.order_number}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(o.created_at)}</td>
                      <td className="px-4 py-3 text-slate-900 font-medium">{o.customer_name}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">{formatCurrency(o.total_rent_amount)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`badge ${getStatusColor(o.status)}`}>{t(o.status as TranslationKey) || o.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
