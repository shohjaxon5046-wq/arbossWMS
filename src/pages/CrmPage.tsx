import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, UserCircle, Search, Star, Phone, Loader2, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatDate, normalizePhone, getStatusColor } from '@/lib/format';
import { LoadingSpinner, ErrorState, EmptyState, PageHeader } from '@/components/ui/States';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import type { Customer, Order, OrderPayment } from '@/types';

export function CrmPage({ initialSearch }: { initialSearch?: string }) {
  const { t } = useApp();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(initialSearch ?? '');
  const [filterDebtors, setFilterDebtors] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [customerPayments, setCustomerPayments] = useState<OrderPayment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const emptyForm = {
    full_name: '', phone_primary: '', phone_secondary: '', balance: '', debt: '',
    passport_series: '', passport_number: '', address: '', notes: '', rating: '5',
  };
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    try {
      const { data, error: queryError } = await supabase
        .from('erp_customers')
        .select('*')
        .order('created_at', { ascending: false });
      if (queryError) throw queryError;
      setCustomers((data || []) as Customer[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      full_name: c.full_name, phone_primary: c.phone_primary, phone_secondary: c.phone_secondary,
      balance: String(c.balance || ''), debt: String(c.debt || ''),
      passport_series: c.passport_series, passport_number: c.passport_number,
      address: c.address, notes: c.notes, rating: String(c.rating || 5),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim() || !form.phone_primary.trim()) return;
    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        phone_primary: form.phone_primary.trim(),
        phone_secondary: form.phone_secondary.trim(),
        balance: Number(form.balance) || 0,
        debt: Number(form.debt) || 0,
        passport_series: form.passport_series.trim(),
        passport_number: form.passport_number.trim(),
        address: form.address.trim(),
        notes: form.notes.trim(),
        rating: Number(form.rating) || 5,
      };
      if (editing) {
        const { error: updateError } = await supabase.from('erp_customers').update(payload).eq('id', editing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('erp_customers').insert(payload);
        if (insertError) throw insertError;
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error: delError } = await supabase.from('erp_customers').delete().eq('id', deleteTarget.id);
      if (delError) throw delError;
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete error');
    }
  };

  const openDetail = async (c: Customer) => {
    setDetailCustomer(c);
    setDetailLoading(true);
    try {
      const [ordersRes, paymentsRes] = await Promise.all([
        supabase.from('erp_orders').select('*').eq('customer_id', c.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('erp_order_payments').select('*, erp_orders!inner(customer_id)').eq('erp_orders.customer_id', c.id).order('created_at', { ascending: false }).limit(20),
      ]);
      setCustomerOrders((ordersRes.data || []) as unknown as Order[]);
      setCustomerPayments((paymentsRes.data || []) as unknown as OrderPayment[]);
    } catch {
      setCustomerOrders([]);
      setCustomerPayments([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    const matchesSearch = c.full_name.toLowerCase().includes(q) || c.phone_primary.includes(q);
    const matchesDebt = !filterDebtors || Number(c.debt) > 0;
    return matchesSearch && matchesDebt;
  });

  if (loading) return <LoadingSpinner text={t('loading')} />;
  if (error) return <ErrorState message={error} />;

  const stats = {
    total: customers.length,
    debtors: customers.filter(c => Number(c.debt) > 0).length,
    totalDebt: customers.reduce((sum, c) => sum + Number(c.debt || 0), 0),
    activeCount: customers.filter(c => c.status === 'aktiv').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('customerCRM')}
        action={<button onClick={openAdd} className="btn-primary"><Plus className="h-4 w-4" /> {t('addCustomer')}</button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs text-slate-400">{t('activeCustomers')}</p>
          <p className="mt-1 text-2xl font-bold text-slate-700 dark:text-slate-200">{stats.activeCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400">{t('debtors')}</p>
          <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">{stats.debtors}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400">{t('debt')}</p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(stats.totalDebt)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400">{t('total')}</p>
          <p className="mt-1 text-2xl font-bold text-slate-700 dark:text-slate-200">{stats.total}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('search')}
            className="input-field pl-9"
          />
        </div>
        <button
          onClick={() => setFilterDebtors(!filterDebtors)}
          className={filterDebtors ? 'btn-danger' : 'btn-secondary'}
        >
          {t('debtors')}: {stats.debtors}
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<UserCircle className="h-12 w-12 text-slate-300 dark:text-slate-600" />}
          title={t('noData')}
          action={<button onClick={openAdd} className="btn-primary"><Plus className="h-4 w-4" /> {t('addCustomer')}</button>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="table-header">{t('customerName')}</th>
                  <th className="table-header">{t('phonePrimary')}</th>
                  <th className="table-header">{t('balance')}</th>
                  <th className="table-header">{t('debt')}</th>
                  <th className="table-header">{t('rating')}</th>
                  <th className="table-header text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="table-cell font-medium">{c.full_name}</td>
                    <td className="table-cell">
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {normalizePhone(c.phone_primary)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={Number(c.balance) > 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                        {formatCurrency(Number(c.balance))}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={Number(c.debt) > 0 ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                        {formatCurrency(Number(c.debt))}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="flex items-center gap-0.5">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {c.rating || 5}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openDetail(c)} title={t('orderHistory')} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('editCustomer') : t('addCustomer')} size="lg">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('customerName')}*</label>
            <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="input-field" placeholder="Aliyev Vali" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('phonePrimary')}*</label>
              <input value={form.phone_primary} onChange={e => setForm({ ...form, phone_primary: e.target.value })} className="input-field" placeholder="+998 90 123-45-67" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('phoneSecondary')}</label>
              <input value={form.phone_secondary} onChange={e => setForm({ ...form, phone_secondary: e.target.value })} className="input-field" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('passportSeries')}</label>
              <input value={form.passport_series} onChange={e => setForm({ ...form, passport_series: e.target.value })} className="input-field" placeholder="AA" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('passportNumber')}</label>
              <input value={form.passport_number} onChange={e => setForm({ ...form, passport_number: e.target.value })} className="input-field" placeholder="1234567" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('balance')}</label>
              <input type="number" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('debt')}</label>
              <input type="number" value={form.debt} onChange={e => setForm({ ...form, debt: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('rating')}</label>
              <input type="number" min="1" max="5" value={form.rating} onChange={e => setForm({ ...form, rating: e.target.value })} className="input-field" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('address2')}</label>
            <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('description')}</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input-field min-h-[60px]" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-ghost">{t('cancel')}</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailCustomer} onClose={() => setDetailCustomer(null)} title={detailCustomer?.full_name || ''} size="lg">
        {detailLoading ? (
          <LoadingSpinner text={t('loading')} />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-400">{t('phonePrimary')}</p>
                <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{normalizePhone(detailCustomer?.phone_primary || '')}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-400">{t('balance')}</p>
                <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(Number(detailCustomer?.balance))}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-400">{t('debt')}</p>
                <p className="mt-1 text-sm font-medium text-red-600 dark:text-red-400">{formatCurrency(Number(detailCustomer?.debt))}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-400">{t('totalSpent')}</p>
                <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{formatCurrency(Number(detailCustomer?.total_spent))}</p>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('orderHistory')}</h4>
              {customerOrders.length === 0 ? (
                <p className="text-sm text-slate-400">{t('noData')}</p>
              ) : (
                <div className="space-y-2">
                  {customerOrders.map(o => (
                    <div key={o.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{o.order_number}</p>
                        <p className="text-xs text-slate-400">{formatDate(o.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">{formatCurrency(o.total_rent_amount)}</span>
                        <span className={`badge ${getStatusColor(o.status)}`}>{t(o.status as never) || o.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('paymentHistory')}</h4>
              {customerPayments.length === 0 ? (
                <p className="text-sm text-slate-400">{t('noData')}</p>
              ) : (
                <div className="space-y-2">
                  {customerPayments.map(p => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
                      <div>
                        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(p.amount)}</p>
                        <p className="text-xs text-slate-400">{formatDate(p.date)}</p>
                      </div>
                      <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">{p.payment_type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('delete')}
        message={`${deleteTarget?.full_name || ''}?`}
      />
    </div>
  );
}
