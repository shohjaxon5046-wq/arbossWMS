import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, FileText, Loader2, PackageCheck, Printer, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/format';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/States';
import { FieldLabel, InlineNotice, type Notice } from '@/components/inbound/InlineNotice';
import { loadOrderBundle, ordersErrorKey, type OrderBundle } from '@/lib/orders';
import { printCashReceipt80mm, printContractA4 } from '@/lib/receipt';
import type { TranslationKey } from '@/lib/i18n';
import type { CashRegister, OrderStatus } from '@/types';

interface Props {
  orderId: string | null;
  onClose: () => void;
  onChanged: () => void;
}

export function OrderDetailModal({ orderId, onClose, onChanged }: Props) {
  const { t } = useApp();
  const { staff } = useAuth();
  const canChangeStatus = staff?.role === 'admin' || staff?.role === 'manager' || staff?.role === 'warehouse';
  const [bundle, setBundle] = useState<OrderBundle | null>(null);
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payType, setPayType] = useState('naqd');
  const [payRegister, setPayRegister] = useState('');
  const [confirm, setConfirm] = useState<'yakunlandi' | 'bekor' | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [b, r] = await Promise.all([
        loadOrderBundle(id),
        supabase.from('erp_cash_registers').select('*').eq('is_active', true).order('name'),
      ]);
      setBundle(b);
      const regs = (r.data || []) as CashRegister[];
      setRegisters(regs);
      setPayRegister(prev => prev || regs[0]?.id || '');
    } catch (err) {
      setNotice({ kind: 'error', text: t(ordersErrorKey(err)) });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    setBundle(null);
    setNotice(null);
    setPayOpen(false);
    if (orderId) load(orderId);
  }, [orderId, load]);

  const run = async (fn: () => PromiseLike<{ error: unknown }>, success?: string) => {
    if (!orderId) return;
    setBusy(true);
    setNotice(null);
    try {
      const { error } = await fn();
      if (error) throw error;
      await load(orderId);
      onChanged();
      if (success) setNotice({ kind: 'success', text: success });
    } catch (err) {
      setNotice({ kind: 'error', text: t(ordersErrorKey(err)) });
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (status: OrderStatus) =>
    run(() => supabase.rpc('erp_set_order_status', { p_order_id: orderId, p_status: status }));

  const addPayment = async () => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return;
    await run(() => supabase.rpc('erp_add_order_payment', {
      p_order_id: orderId, p_amount: amount, p_type: payType, p_register_id: payRegister || null,
    }));
    setPayAmount('');
    setPayOpen(false);
  };

  const [printing, setPrinting] = useState(false);

  const handlePrintReceipt = async (receiptType: 'simple' | 'contract') => {
    if (!bundle) return;
    setPrinting(true);
    try {
      if (receiptType === 'simple') {
        await printCashReceipt80mm(bundle, t);
      } else {
        await printContractA4(bundle, t);
      }
    } catch (err) {
      setNotice({ kind: 'error', text: t(ordersErrorKey(err)) });
    } finally {
      setPrinting(false);
    }
  };

  const order = bundle?.order;
  const open = order && order.status !== 'yakunlandi' && order.status !== 'bekor';

  return (
    <Modal open={!!orderId} onClose={onClose} title={order?.order_number || ''} size="xl">
      {loading && !bundle ? <LoadingSpinner text={t('loading')} /> : !bundle || !order ? (
        <InlineNotice notice={notice} onClose={() => setNotice(null)} />
      ) : (
        <div className="space-y-6">
          <InlineNotice notice={notice} onClose={() => setNotice(null)} />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{order.customer_name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{order.customer_phone}{bundle.passport && ` · ${bundle.passport}`}</p>
              <p className="mt-1 text-xs text-slate-400">
                {formatDate(order.created_at)}
                {order.expected_return_date && ` → ${t('ordReturnBy')}: ${formatDate(order.expected_return_date)}`}
                {order.delivery_type === 'delivery' && order.delivery_address && ` · ${order.delivery_address}`}
              </p>
            </div>
            <span className={`badge ${getStatusColor(order.status)}`}>{t(order.status as TranslationKey) || order.status}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t('ordGrandTotal')} value={formatCurrency(order.total_rent_amount)} />
            <Stat label={t('paidAmount')} value={formatCurrency(order.paid_amount)} tone="text-emerald-600 dark:text-emerald-400" />
            <Stat label={t('ordRemaining')} value={formatCurrency(order.debt_amount)} tone={Number(order.debt_amount) > 0 ? 'text-red-600 dark:text-red-400' : undefined} />
            <Stat label={t('ordDeposit')} value={formatCurrency(order.total_deposit_amount)} tone="text-amber-600 dark:text-amber-400" />
          </div>

          {bundle.items.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-900">{t('ordItemsSection')}</h4>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {bundle.items.map(oi => (
                  <div key={oi.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{oi.model_name}</p>
                      <p className="text-xs text-slate-500">
                        <span className="font-mono">{oi.serial_number}</span> · {oi.rent_days} {t('ordDays')} × {formatCurrency(oi.daily_price)}
                        {Number(oi.discount_pct) > 0 && ` · −${Number(oi.discount_pct)}%`}
                      </p>
                    </div>
                    {oi.return_status === 'qaytarildi' && Number(oi.depreciation_applied) > 0 && (
                      <span className="hidden text-xs text-slate-400 sm:inline">{t('ordDepreciationApplied')}: {formatCurrency(oi.depreciation_applied)}</span>
                    )}
                    {oi.return_status === 'qaytarildi' && <PackageCheck className="h-4 w-4 text-emerald-500" />}
                    <span className="text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(oi.line_total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bundle.payments.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('ordPaymentsSection')}</h4>
              <div className="space-y-1.5">
                {bundle.payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(p.amount)}</span>
                    <span className="text-xs text-slate-400">{p.payment_type} · {formatDate(p.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {payOpen && (
            <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 animate-fade-in dark:border-blue-900/50 dark:bg-blue-900/10">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <FieldLabel>{t('amount')}</FieldLabel>
                  <input autoFocus type="number" min="0" max={order.debt_amount} value={payAmount} onChange={e => setPayAmount(e.target.value)} className="input-field" />
                </div>
                <div>
                  <FieldLabel>{t('paymentType')}</FieldLabel>
                  <select value={payType} onChange={e => setPayType(e.target.value)} className="input-field">
                    <option value="naqd">{t('cash')}</option>
                    <option value="plastik">{t('card')}</option>
                    <option value="o'tkazma">{t('transfer')}</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>{t('cashRegisters')}</FieldLabel>
                  <select value={payRegister} onChange={e => setPayRegister(e.target.value)} className="input-field">
                    <option value="">—</option>
                    {registers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setPayOpen(false)} className="btn-ghost">{t('cancel')}</button>
                <button onClick={() => setPayAmount(String(order.debt_amount))} className="btn-secondary">{t('ordPayFull')}</button>
                <button onClick={addPayment} disabled={busy || !Number(payAmount)} className="btn-primary">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t('save')}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => handlePrintReceipt('simple')}
              disabled={printing}
              className="btn-secondary"
              title="80mm termoprinter uchun oddiy kassa cheki"
            >
              <Printer className="h-4 w-4 text-blue-600" />
              <span>🧾 Kassa cheki (80mm)</span>
            </button>
            <button
              type="button"
              onClick={() => handlePrintReceipt('contract')}
              disabled={printing}
              className="btn-secondary"
              title="A4 formatdagi yuridik ijara shartnomasi va dalolatnoma"
            >
              <FileText className="h-4 w-4 text-indigo-600" />
              <span>📄 Shartnoma (A4)</span>
            </button>
            {Number(order.debt_amount) > 0 && order.status !== 'bekor' && !payOpen && (
              <button onClick={() => setPayOpen(true)} className="btn-primary"><CreditCard className="h-4 w-4" /> {t('receivePayment')}</button>
            )}
            {open && canChangeStatus && (
              <>
                {order.status === 'yangi' && bundle.items.length > 0 && (
                  <button onClick={() => setStatus('yigilmoqda')} disabled={busy} className="btn-secondary">{t('assembling')}</button>
                )}
                {(order.status === 'yangi' || order.status === 'yigilmoqda') && (
                  <button onClick={() => setStatus('faol_ijarada')} disabled={busy} className="btn-secondary">{t('activeRental')}</button>
                )}
                <button onClick={() => setConfirm('yakunlandi')} disabled={busy} className="btn-secondary text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> {t('ordComplete')}
                </button>
                <button onClick={() => setConfirm('bekor')} disabled={busy} className="btn-danger ml-auto">
                  <XCircle className="h-4 w-4" /> {t('ordCancel')}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)}
        onConfirm={() => { const s = confirm; setConfirm(null); if (s) setStatus(s); }}
        title={confirm === 'bekor' ? t('ordCancel') : t('ordComplete')}
        message={confirm === 'bekor' ? t('ordConfirmCancel') : t('ordConfirmComplete')} />
    </Modal>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-base font-bold tabular-nums ${tone ?? 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
    </div>
  );
}
