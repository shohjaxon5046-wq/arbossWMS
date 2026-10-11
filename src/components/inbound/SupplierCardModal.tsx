import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatDate } from '@/lib/format';
import { Modal } from '@/components/ui/Modal';
import { InlineNotice, FieldLabel } from '@/components/inbound/InlineNotice';
import { Building, Phone, User, Receipt, Plus, Loader2 } from 'lucide-react';
import type { Supplier, SupplierTransaction } from '@/types';

interface Props {
  supplier: Supplier | null;
  onClose: () => void;
  onUpdate: () => void;
}

export function SupplierCardModal({ supplier, onClose, onUpdate }: Props) {
  const { t } = useApp();
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [form, setForm] = useState({ amount: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supplier) return;
    loadTransactions();
  }, [supplier]);

  const loadTransactions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('erp_supplier_transactions')
      .select('*')
      .eq('supplier_id', supplier!.id)
      .order('date', { ascending: false });
    if (data) setTransactions(data as SupplierTransaction[]);
    setLoading(false);
  };

  const handlePayment = async () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setError('Sumanini kiriting');
      return;
    }
    setSaving(true);
    
    // Check if table exists
    const { error: insErr } = await supabase.from('erp_supplier_transactions').insert({
      supplier_id: supplier!.id,
      transaction_type: 'payment',
      amount: amount,
      notes: form.notes.trim()
    });
    
    setSaving(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    
    setPaymentOpen(false);
    setForm({ amount: '', notes: '' });
    loadTransactions();
    onUpdate(); // to update balance in parent
  };

  if (!supplier) return null;

  return (
    <>
      <Modal open={!!supplier} onClose={onClose} title="Yetkazib beruvchi kartochkasi" size="xl">
        <div className="space-y-6">
          {/* Header Info */}
          <div className="flex items-start justify-between rounded-xl bg-slate-50 p-5 dark:bg-slate-800/50">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                <Building className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{supplier.name}</h3>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                  {supplier.contact_person && (
                    <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> {supplier.contact_person}</span>
                  )}
                  {supplier.phone && (
                    <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {supplier.phone}</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Balans</p>
              <p className={`text-xl font-bold ${supplier.balance < 0 ? 'text-emerald-600 dark:text-emerald-400' : supplier.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                {supplier.balance > 0 ? '-' : ''}{formatCurrency(Math.abs(supplier.balance))}
              </p>
              <button onClick={() => setPaymentOpen(true)} className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
                + To'lov qilish
              </button>
            </div>
          </div>

          {/* Transactions List */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">To'lov va Xaridlar tarixi</h4>
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-2 font-medium text-slate-500">Sana</th>
                    <th className="px-4 py-2 font-medium text-slate-500">Turi</th>
                    <th className="px-4 py-2 text-right font-medium text-slate-500">Summa</th>
                    <th className="px-4 py-2 font-medium text-slate-500">Izoh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr><td colSpan={4} className="p-4 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr>
                  ) : transactions.length === 0 ? (
                    <tr><td colSpan={4} className="p-4 text-center text-slate-500">Hech qanday ma'lumot yo'q</td></tr>
                  ) : (
                    transactions.map(t => (
                      <tr key={t.id}>
                        <td className="px-4 py-3">{formatDate(t.date)}</td>
                        <td className="px-4 py-3">
                          {t.transaction_type === 'payment' && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"><Receipt className="h-3 w-3" /> To'lov</span>}
                          {t.transaction_type === 'purchase' && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"><Building className="h-3 w-3" /> Xarid</span>}
                          {t.transaction_type === 'return' && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">Qaytarish</span>}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${t.transaction_type === 'payment' || t.transaction_type === 'return' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {t.transaction_type === 'payment' || t.transaction_type === 'return' ? '+' : '-'}{formatCurrency(t.amount)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{t.notes}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Modal>

      {/* Payment Modal */}
      {paymentOpen && (
        <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="To'lov qilish" size="sm">
          <div className="space-y-4">
            <div>
              <FieldLabel>Summa *</FieldLabel>
              <input type="number" min={0} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="input-field text-lg font-semibold" placeholder="0" />
            </div>
            <div>
              <FieldLabel>Izoh</FieldLabel>
              <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input-field" placeholder="Masalan: Plastik karta orqali" />
            </div>
            {error && <InlineNotice notice={{ kind: 'error', text: error }} onClose={() => setError('')} />}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setPaymentOpen(false)} className="btn-ghost">Bekor qilish</button>
              <button onClick={handlePayment} disabled={saving} className="btn-primary">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Tasdiqlash
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
