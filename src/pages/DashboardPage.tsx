import { useEffect, useState } from 'react';
import {
  Wallet, Package, AlertTriangle, TrendingUp, ShoppingCart,
  UserPlus, FileMinus, ArrowRight, Clock, Wrench,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/format';
import { LoadingSpinner, EmptyState, PageHeader } from '@/components/ui/States';
import type { PageId } from '@/components/Layout';
import type { Order, CashRegister, ProductItem } from '@/types';

interface DashboardData {
  totalCash: number;
  activeOrders: number;
  overdueOrders: number;
  netProfit: number;
  totalEquipment: number;
  availableEquipment: number;
  rentedEquipment: number;
  inRepair: number;
  awaitingPutaway: number;
  awaitingReturn: number;
  recentOrders: Order[];
  overdueList: Order[];
}

export function DashboardPage({ onPageChange }: { onPageChange: (page: PageId) => void }) {
  const { t } = useApp();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [cashRes, ordersRes, allOrdersRes, itemsRes, expensesRes, paymentsRes] = await Promise.all([
        supabase.from('erp_cash_registers').select('*'),
        supabase.from('erp_orders').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('erp_orders').select('id, status'),
        supabase.from('erp_product_items').select('status'),
        supabase.from('erp_expenses').select('amount'),
        supabase.from('erp_order_payments').select('amount, order_id'),
      ]);

      const registers = (cashRes.data || []) as CashRegister[];
      const recentOrders = (ordersRes.data || []) as Order[];
      const allOrders = (allOrdersRes.data || []) as { id: string, status: string }[];
      const items = (itemsRes.data || []) as { status: string }[];
      const expenses = (expensesRes.data || []) as { amount: number }[];
      const payments = (paymentsRes.data || []) as { amount: number, order_id: string }[];

      const totalCash = registers.reduce((sum, r) => sum + Number(r.current_balance || 0), 0);
      const activeOrders = allOrders.filter(o => o.status === 'faol_ijarada').length;
      const overdueOrders = allOrders.filter(o => o.status === 'kechikkan').length;
      
      const cancelledIds = new Set(allOrders.filter(o => o.status === 'bekor').map(o => o.id));
      const validPayments = payments.filter(p => !cancelledIds.has(p.order_id));
      
      const totalRevenue = validPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const netProfit = totalRevenue - totalExpenses;

      const available = items.filter(i => i.status === 'omborda_bosh').length;
      const rented = items.filter(i => i.status === 'ijarada').length;
      const repair = items.filter(i => i.status === 'tamirda').length;
      const awaitingPutaway = items.filter(i => i.status === 'joylashtirish_kutilmoqda').length;
      const awaitingReturn = items.filter(i => i.status === 'qaytarish_kutilmoqda').length;
      
      const overdueList = recentOrders.filter(o => o.status === 'kechikkan');

      setData({
        totalCash,
        activeOrders,
        overdueOrders, // it's already a number
        netProfit,
        totalEquipment: items.length,
        availableEquipment: available,
        rentedEquipment: rented,
        inRepair: repair,
        awaitingPutaway,
        awaitingReturn,
        recentOrders: recentOrders.slice(0, 5),
        overdueList: overdueList.slice(0, 5),
      });
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSpinner text={t('loading')} />;
  if (!data) return <EmptyState title={t('noData')} />;

  const kpis = [
    { label: t('totalCash'), value: formatCurrency(data.totalCash), icon: Wallet, color: 'blue' },
    { label: t('activeOrders'), value: String(data.activeOrders), icon: ShoppingCart, color: 'emerald' },
    { label: t('overdueOrders'), value: String(data.overdueOrders), icon: AlertTriangle, color: 'red' },
    { label: t('netProfit'), value: formatCurrency(data.netProfit), icon: TrendingUp, color: 'amber' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
  };

  const equipmentStats = [
    { label: t('totalEquipment'), value: data.totalEquipment, color: 'text-slate-700 dark:text-slate-200' },
    { label: t('availableEquipment'), value: data.availableEquipment, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: t('rentedEquipment'), value: data.rentedEquipment, color: 'text-blue-600 dark:text-blue-400' },
    { label: t('inRepair'), value: data.inRepair, color: 'text-amber-600 dark:text-amber-400' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('dashboard')} subtitle={formatDate(new Date().toISOString())} />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="card card-hover p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{kpi.label}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{kpi.value}</p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorMap[kpi.color]}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Equipment status */}
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('equipmentStatus')}</h3>
          </div>
          <div className="space-y-3">
            {equipmentStats.map((stat) => (
              <div key={stat.label} className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">{stat.label}</span>
                <span className={`text-lg font-bold ${stat.color}`}>{stat.value}</span>
              </div>
            ))}
          </div>
          {(data.awaitingPutaway > 0 || data.awaitingReturn > 0) && (
            <div className="mt-4 space-y-2">
              {data.awaitingPutaway > 0 && (
                <button onClick={() => onPageChange('inbound')} className="flex w-full items-center justify-between rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800 transition-colors hover:bg-sky-100 dark:bg-sky-900/20 dark:text-sky-300 dark:hover:bg-sky-900/30">
                  <span>{t('awaitingPutaway')}</span><b>{data.awaitingPutaway}</b>
                </button>
              )}
              {data.awaitingReturn > 0 && (
                <button onClick={() => onPageChange('inbound')} className="flex w-full items-center justify-between rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800 transition-colors hover:bg-orange-100 dark:bg-orange-900/20 dark:text-orange-300 dark:hover:bg-orange-900/30">
                  <span>{t('awaitingReturn')}</span><b>{data.awaitingReturn}</b>
                </button>
              )}
            </div>
          )}
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="flex h-full">
              <div className="bg-emerald-500" style={{ width: `${data.totalEquipment ? (data.availableEquipment / data.totalEquipment) * 100 : 0}%` }} />
              <div className="bg-blue-500" style={{ width: `${data.totalEquipment ? (data.rentedEquipment / data.totalEquipment) * 100 : 0}%` }} />
              <div className="bg-amber-500" style={{ width: `${data.totalEquipment ? (data.inRepair / data.totalEquipment) * 100 : 0}%` }} />
            </div>
          </div>
        </div>

        {/* Recent orders */}
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('recentOrders')}</h3>
            <button onClick={() => onPageChange('orders')} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
              {t('all')} <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {data.recentOrders.length === 0 ? (
            <EmptyState title={t('noData')} icon={<ShoppingCart className="h-10 w-10 text-slate-300 dark:text-slate-600" />} />
          ) : (
            <div className="space-y-2">
              {data.recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 dark:border-slate-800">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{order.order_number}</p>
                    <p className="truncate text-xs text-slate-400 dark:text-slate-500">{order.customer_name || '—'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(order.total_rent_amount)}</span>
                    <span className={`badge ${getStatusColor(order.status)}`}>{t(order.status as never) || order.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alerts and quick actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Alerts */}
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('alerts')}</h3>
          </div>
          {data.overdueList.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <Clock className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              </span>
              {t('noAlerts')}
            </div>
          ) : (
            <div className="space-y-2">
              {data.overdueList.map((order) => (
                <div key={order.id} className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2.5 dark:bg-red-900/10">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{order.order_number}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{order.customer_name} · {formatDate(order.expected_return_date)}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">{formatCurrency(order.total_deposit_amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('quickActions')}</h3>
          <div className="grid grid-cols-3 gap-3">
            <button onClick={() => onPageChange('orders')} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 p-4 text-center transition-all hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-blue-900/10">
              <ShoppingCart className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('newOrder')}</span>
            </button>
            <button onClick={() => onPageChange('crm')} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 p-4 text-center transition-all hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/10">
              <UserPlus className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('newCustomer')}</span>
            </button>
            <button onClick={() => onPageChange('finance')} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 p-4 text-center transition-all hover:border-red-300 hover:bg-red-50 dark:border-slate-700 dark:hover:border-red-700 dark:hover:bg-red-900/10">
              <FileMinus className="h-6 w-6 text-red-600 dark:text-red-400" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('newExpense')}</span>
            </button>
            <button onClick={() => onPageChange('inbound')} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 p-4 text-center transition-all hover:border-amber-300 hover:bg-amber-50 dark:border-slate-700 dark:hover:border-amber-700 dark:hover:bg-amber-900/10">
              <Wrench className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('inbound')}</span>
            </button>
            <button onClick={() => onPageChange('partners')} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 p-4 text-center transition-all hover:border-teal-300 hover:bg-teal-50 dark:border-slate-700 dark:hover:border-teal-700 dark:hover:bg-teal-900/10">
              <Package className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('partners')}</span>
            </button>
            <button onClick={() => onPageChange('ai')} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 p-4 text-center transition-all hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-blue-900/10">
              <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('aiCopilot')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
