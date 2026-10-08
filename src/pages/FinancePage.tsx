import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Wallet, TrendingUp, TrendingDown, Loader2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatDate } from '@/lib/format';
import { LoadingSpinner, ErrorState, EmptyState, PageHeader } from '@/components/ui/States';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import type { CashRegister, Expense, OrderPayment } from '@/types';

export function FinancePage() {
  const { t } = useApp();
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<OrderPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'summary' | 'registers' | 'expenses' | 'payments'>('summary');
  const [registerModal, setRegisterModal] = useState(false);
  const [expenseModal, setExpenseModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteExpense, setDeleteExpense] = useState<Expense | null>(null);
  const [search, setSearch] = useState('');

  const [regForm, setRegForm] = useState({ name: '', currency: 'UZS', current_balance: '' });
  const [expForm, setExpForm] = useState({ title: '', amount: '', category: 'boshqa', cash_register_id: '', date: '', notes: '' });

  const loadData = useCallback(async () => {
    try {
      const [regRes, expRes, payRes] = await Promise.all([
        supabase.from('erp_cash_registers').select('*').order('created_at', { ascending: false }),
        supabase.from('erp_expenses').select('*').order('date', { ascending: false }),
        supabase.from('erp_order_payments').select('*').order('date', { ascending: false }),
      ]);
      if (regRes.error) throw regRes.error;
      if (expRes.error) throw expRes.error;
      if (payRes.error) throw payRes.error;
      setRegisters((regRes.data || []) as CashRegister[]);
      setExpenses((expRes.data || []) as Expense[]);
      setPayments((payRes.data || []) as OrderPayment[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const totalCash = registers.reduce((sum, r) => sum + Number(r.current_balance || 0), 0);
  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  const handleSaveRegister = async () => {
    if (!regForm.name.trim()) return;
    setSaving(true);
    try {
      const { error: insertError } = await supabase.from('erp_cash_registers').insert({
        name: regForm.name.trim(),
        currency: regForm.currency,
        current_balance: Number(regForm.current_balance) || 0,
        is_active: true,
      });
      if (insertError) throw insertError;
      setRegisterModal(false);
      setRegForm({ name: '', currency: 'UZS', current_balance: '' });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExpense = async () => {
    if (!expForm.title.trim() || !expForm.amount) return;
    setSaving(true);
    try {
      const amount = Number(expForm.amount);
      const { error: insertError } = await supabase.from('erp_expenses').insert({
        title: expForm.title.trim(),
        amount,
        category: expForm.category,
        cash_register_id: expForm.cash_register_id || null,
        date: expForm.date ? new Date(expForm.date).toISOString() : new Date().toISOString(),
        notes: expForm.notes.trim(),
      });
      if (insertError) throw insertError;

      if (expForm.cash_register_id) {
        const reg = registers.find(r => r.id === expForm.cash_register_id);
        if (reg) {
          await supabase.from('erp_cash_registers')
            .update({ current_balance: Number(reg.current_balance) - amount })
            .eq('id', reg.id);
        }
      }

      setExpenseModal(false);
      setExpForm({ title: '', amount: '', category: 'boshqa', cash_register_id: '', date: '', notes: '' });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteExpense) return;
    try {
      const { error: delError } = await supabase.from('erp_expenses').delete().eq('id', deleteExpense.id);
      if (delError) throw delError;
      setDeleteExpense(null);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete error');
    }
  };

  const categoryOptions = [
    { value: 'ijara', label: t('rent') },
    { value: 'maosh', label: t('salary') },
    { value: 'kommunal', label: t('utilities') },
    { value: 'transport', label: t('transport') },
    { value: 'materiallar', label: t('materials') },
    { value: 'boshqa', label: t('other') },
  ];

  if (loading) return <LoadingSpinner text={t('loading')} />;
  if (error) return <ErrorState message={error} />;

  const tabs = [
    { id: 'summary' as const, label: t('profitLoss') },
    { id: 'registers' as const, label: t('cashRegisters') },
    { id: 'expenses' as const, label: t('expenses') },
    { id: 'payments' as const, label: t('payments') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('financeReports')}
        action={
          <div className="flex gap-2">
            <button onClick={() => setRegisterModal(true)} className="btn-secondary"><Plus className="h-4 w-4" /> {t('addCashRegister')}</button>
            <button onClick={() => setExpenseModal(true)} className="btn-primary"><Plus className="h-4 w-4" /> {t('addExpense')}</button>
          </div>
        }
      />

      <div className="flex gap-2 overflow-x-auto rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        {tabs.map(tabItem => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className={`flex-shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-all ${tab === tabItem.id ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('revenue')}</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalRevenue)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('totalExpenses')}</p>
                  <p className="mt-2 text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalExpenses)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  <TrendingDown className="h-6 w-6" />
                </div>
              </div>
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('netProfit')}</p>
                  <p className={`mt-2 text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(netProfit)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                  <Wallet className="h-6 w-6" />
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('cashRegisters')}</h3>
            <div className="space-y-3">
              {registers.map(r => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                      <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{r.name}</p>
                      <p className="text-xs text-slate-400">{r.currency}</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatCurrency(Number(r.current_balance))}</span>
                </div>
              ))}
              {registers.length === 0 && <p className="text-sm text-slate-400">{t('noData')}</p>}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('totalCash')}</span>
              <span className="text-xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totalCash)}</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'registers' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="table-header">{t('name')}</th>
                  <th className="table-header">{t('currency')}</th>
                  <th className="table-header">{t('currentBalance')}</th>
                  <th className="table-header">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {registers.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="table-cell font-medium">{r.name}</td>
                    <td className="table-cell">{r.currency}</td>
                    <td className="table-cell font-semibold">{formatCurrency(Number(r.current_balance))}</td>
                    <td className="table-cell">
                      <span className={`badge ${r.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                        {r.is_active ? t('active') : t('inactive')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'expenses' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="input-field pl-9" />
          </div>
          {expenses.length === 0 ? (
            <EmptyState icon={<TrendingDown className="h-12 w-12 text-slate-300 dark:text-slate-600" />} title={t('noData')} />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                    <tr>
                      <th className="table-header">{t('name')}</th>
                      <th className="table-header">{t('amount')}</th>
                      <th className="table-header">{t('expenseCategory')}</th>
                      <th className="table-header">{t('date')}</th>
                      <th className="table-header text-right">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {expenses.filter(e => {
                      const q = search.toLowerCase();
                      return e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
                    }).map(e => (
                      <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="table-cell font-medium">{e.title}</td>
                        <td className="table-cell font-semibold text-red-600 dark:text-red-400">{formatCurrency(e.amount)}</td>
                        <td className="table-cell">
                          <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {categoryOptions.find(c => c.value === e.category)?.label || e.category}
                          </span>
                        </td>
                        <td className="table-cell">{formatDate(e.date)}</td>
                        <td className="table-cell text-right">
                          <button onClick={() => setDeleteExpense(e)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="table-header">{t('amount')}</th>
                  <th className="table-header">{t('paymentType')}</th>
                  <th className="table-header">{t('date')}</th>
                  <th className="table-header">{t('description')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.length === 0 ? (
                  <tr><td colSpan={4} className="table-cell text-center text-slate-400 py-8">{t('noData')}</td></tr>
                ) : payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="table-cell font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(p.amount)}</td>
                    <td className="table-cell">
                      <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">{p.payment_type}</span>
                    </td>
                    <td className="table-cell">{formatDate(p.date)}</td>
                    <td className="table-cell text-slate-400">{p.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Register Modal */}
      <Modal open={registerModal} onClose={() => setRegisterModal(false)} title={t('addCashRegister')} size="sm">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('name')}</label>
            <input value={regForm.name} onChange={e => setRegForm({ ...regForm, name: e.target.value })} className="input-field" placeholder="Bosh kassa" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('currency')}</label>
              <select value={regForm.currency} onChange={e => setRegForm({ ...regForm, currency: e.target.value })} className="input-field">
                <option value="UZS">UZS</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('currentBalance')}</label>
              <input type="number" value={regForm.current_balance} onChange={e => setRegForm({ ...regForm, current_balance: e.target.value })} className="input-field" placeholder="0" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setRegisterModal(false)} className="btn-ghost">{t('cancel')}</button>
            <button onClick={handleSaveRegister} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Expense Modal */}
      <Modal open={expenseModal} onClose={() => setExpenseModal(false)} title={t('addExpense')}>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('name')}</label>
            <input value={expForm.title} onChange={e => setExpForm({ ...expForm, title: e.target.value })} className="input-field" placeholder={t('addExpense')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('amount')}</label>
              <input type="number" value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })} className="input-field" placeholder="0" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('expenseCategory')}</label>
              <select value={expForm.category} onChange={e => setExpForm({ ...expForm, category: e.target.value })} className="input-field">
                {categoryOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('cashRegisters')}</label>
              <select value={expForm.cash_register_id} onChange={e => setExpForm({ ...expForm, cash_register_id: e.target.value })} className="input-field">
                <option value="">—</option>
                {registers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('date')}</label>
              <input type="date" value={expForm.date} onChange={e => setExpForm({ ...expForm, date: e.target.value })} className="input-field" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('description')}</label>
            <input value={expForm.notes} onChange={e => setExpForm({ ...expForm, notes: e.target.value })} className="input-field" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setExpenseModal(false)} className="btn-ghost">{t('cancel')}</button>
            <button onClick={handleSaveExpense} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('save')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteExpense}
        onClose={() => setDeleteExpense(null)}
        onConfirm={handleDeleteExpense}
        title={t('delete')}
        message={`${deleteExpense?.title || ''}?`}
      />
    </div>
  );
}
