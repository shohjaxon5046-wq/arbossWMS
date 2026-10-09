import { useEffect, useState, useMemo } from 'react';
import { Calendar, DollarSign, Package, TrendingUp, Search } from 'lucide-react';
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
  services: { service_category: string; customer_total_price: number }[];
}

export function MyOrdersPage() {
  const { t } = useApp();
  const { staff } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<OrderStat[]>([]);
  const [rates, setRates] = useState({ uskuna: 0, kran: 0, musir: 0, gruzchik: 0 });
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
          id, order_number, status, created_at, customer_name, total_rent_amount,
          services:erp_service_orders(service_category, customer_total_price)
        `).eq('created_by_user_id', staff!.user_id).order('created_at', { ascending: false })
      ]);

      if (ordersRes.error) throw ordersRes.error;
      
      const r = settingsRes.data?.value as any;
      setRates({
        uskuna: r?.uskuna || 0,
        kran: r?.kran || 0,
        musir: r?.musir || 0,
        gruzchik: r?.gruzchik || 0
      });
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
    let serviceBonus = 0;
    let validCount = 0;

    for (const o of filteredOrders) {
      if (o.status === 'bekor') continue; // Do not calculate bonus for cancelled orders
      validCount++;
      
      // Rent bonus
      rentBonus += (Number(o.total_rent_amount) || 0) * (rates.uskuna / 100);

      // Service bonus
      for (const s of o.services || []) {
        const cat = (s.service_category || '').toLowerCase();
        let rate = 0;
        if (cat.includes('kran')) rate = rates.kran;
        else if (cat.includes('musir') || cat.includes('chiqindi') || cat.includes('musor')) rate = rates.musir;
        else if (cat.includes('gruzchik') || cat.includes('yukchi') || cat.includes('yuk')) rate = rates.gruzchik;
        
        serviceBonus += (Number(s.customer_total_price) || 0) * (rate / 100);
      }
    }
    return { rentBonus, serviceBonus, totalBonus: rentBonus + serviceBonus, validCount };
  }, [filteredOrders, rates]);

  if (loading) return <LoadingSpinner text={t('loading')} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Mening profilim va savdolarim" subtitle="O'zingiz yaratgan buyurtmalar va ishlab topgan bonuslaringiz" />

      <div className="flex gap-2 mb-6">
        <button onClick={() => setDateRange('today')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateRange === 'today' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>Bugun</button>
        <button onClick={() => setDateRange('month')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateRange === 'month' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>Shu oy</button>
        <button onClick={() => setDateRange('all')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateRange === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>Barcha vaqt</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 border-t-4 border-t-emerald-500">
          <p className="text-sm font-medium text-slate-500">Jami bonus (Toza daromad)</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(stats.totalBonus)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-slate-500">Uskunalar ijarasidan ({rates.uskuna}%)</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(stats.rentBonus)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-slate-500">Xizmatlardan</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(stats.serviceBonus)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-slate-500">Faol buyurtmalar (Bekor qilinmagan)</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.validCount} ta</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Buyurtmalar ro'yxati</h3>
          <span className="text-xs text-slate-500">Bekor qilingan buyurtmalar bonusga kirmaydi</span>
        </div>
        {filteredOrders.length === 0 ? (
          <EmptyState title="Buyurtmalar yo'q" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/60">
                <tr>
                  <th className="px-4 py-3 text-left">Buyurtma</th>
                  <th className="px-4 py-3 text-left">Sana</th>
                  <th className="px-4 py-3 text-left">Mijoz</th>
                  <th className="px-4 py-3 text-right">Ijara summasi</th>
                  <th className="px-4 py-3 text-right">Xizmat summasi</th>
                  <th className="px-4 py-3 text-center">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredOrders.map(o => {
                  const serviceTotal = o.services?.reduce((sum, s) => sum + Number(s.customer_total_price || 0), 0) || 0;
                  const isCancelled = o.status === 'bekor';
                  return (
                    <tr key={o.id} className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${isCancelled ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 font-mono font-medium">{o.order_number}</td>
                      <td className="px-4 py-3">{formatDate(o.created_at)}</td>
                      <td className="px-4 py-3">{o.customer_name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(o.total_rent_amount)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(serviceTotal)}</td>
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
