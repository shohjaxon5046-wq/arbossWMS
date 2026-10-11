import { useEffect, useState, useRef } from 'react';
import { Printer, FileText, CheckCircle2, Loader2, AlertCircle, Eye, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { loadOrderBundle } from '@/lib/orders';
import { printCashReceipt80mm, printContractA4 } from '@/lib/receipt';
import { formatCurrency, formatDate } from '@/lib/format';
import type { OrderBundle } from '@/lib/orders';

interface Props {
  open: boolean;
  orderId: string | null;
  onClose: () => void;
}

export type ReceiptType = 'simple' | 'contract';

export function OrderPrintModal({ open, orderId, onClose }: Props) {
  const [activePrintType, setActivePrintType] = useState<ReceiptType | null>(null);
  const [bundle, setBundle] = useState<OrderBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (open && orderId) {
      setLoading(true);
      setError('');
      loadOrderBundle(orderId)
        .then(b => {
          setBundle(b);
        })
        .catch(err => {
          console.error('Failed to load order for printing:', err);
          setError('Buyurtma ma\'lumotlarini yuklab bo\'lmadi');
        })
        .finally(() => setLoading(false));
    } else {
      setBundle(null);
      setActivePrintType(null);
      setPreviewOpen(false);
    }
  }, [open, orderId]);

  if (!open || !orderId) return null;

  // Safe Print Handler specified by user
  const handlePrintReceipt = async (receiptType: ReceiptType) => {
    setError('');
    setActivePrintType(receiptType);

    try {
      let b = bundle;
      if (!b) {
        b = await loadOrderBundle(orderId);
        setBundle(b);
      }

      if (receiptType === 'simple') {
        await printCashReceipt80mm(b);
      } else {
        await printContractA4(b);
      }

      // Safe trigger with focus & print
      setTimeout(() => {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.warn('Window print notice:', e);
        }
      }, 200);
    } catch (err: any) {
      console.error('Print receipt error:', err);
      setError(err?.message || 'Chop etishda xatolik yuz berdi');
    }
  };

  const order = bundle?.order;
  const items = bundle?.items || [];
  const customer = bundle?.customer;
  const payments = bundle?.payments || [];
  const payType = payments.length ? payments.map(p => p.payment_type).join(', ') : 'Naqd';

  return (
    <>
      <Modal open={open} onClose={onClose} title="Buyurtma tasdiqlandi — Chek chiqarish" size="md">
        <div className="space-y-5 text-center">
          {/* Success Icon & Heading */}
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Buyurtma muvaffaqiyatli saqlandi!
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Mijoz: <span className="font-semibold text-slate-800">{order?.customer_name || '—'}</span> | Buyurtma: <span className="font-mono font-semibold text-blue-600">{order?.order_number || '—'}</span>
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-left text-xs text-red-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons as requested */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 pt-1">
            {/* 80mm Cash Receipt */}
            <button
              type="button"
              onClick={() => handlePrintReceipt('simple')}
              disabled={loading}
              className={`group flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-5 text-center transition-all disabled:opacity-50 ${
                activePrintType === 'simple'
                  ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/20'
                  : 'border-blue-200 bg-blue-50/50 hover:border-blue-500 hover:bg-blue-100/60 hover:shadow-md'
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition-transform group-hover:scale-105">
                {loading && activePrintType === 'simple' ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Printer className="h-6 w-6" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">[ 🧾 Oddiy kassa cheki ]</p>
                <p className="text-[11px] font-medium text-slate-500">80mm termoprinter uchun</p>
              </div>
              <span className="mt-1 inline-block rounded-md bg-blue-600/10 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
                Tezkor kassa cheki
              </span>
            </button>

            {/* A4 Legal Contract */}
            <button
              type="button"
              onClick={() => handlePrintReceipt('contract')}
              disabled={loading}
              className={`group flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-5 text-center transition-all disabled:opacity-50 ${
                activePrintType === 'contract'
                  ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600/20'
                  : 'border-indigo-200 bg-indigo-50/50 hover:border-indigo-500 hover:bg-indigo-100/60 hover:shadow-md'
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition-transform group-hover:scale-105">
                {loading && activePrintType === 'contract' ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <FileText className="h-6 w-6" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">[ 📄 Shartnoma bilan chiqarish (A4) ]</p>
                <p className="text-[11px] font-medium text-slate-500">A4 to'liq yuridik shartnoma</p>
              </div>
              <span className="mt-1 inline-block rounded-md bg-indigo-600/10 px-2.5 py-1 text-[10px] font-semibold text-indigo-700">
                Qabul-topshirish akti bilan
              </span>
            </button>
          </div>

          {/* Optional On-screen Preview Toggle */}
          {bundle && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPreviewOpen(!previewOpen)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 hover:underline"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>{previewOpen ? 'Oldindan ko\'rishni yashirish' : 'Ekranda oldindan ko\'rish'}</span>
              </button>
            </div>
          )}

          {/* Quick inline preview container if requested */}
          {previewOpen && bundle && (
            <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-xs text-slate-700">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-900">Chek xulosasi:</span>
                <span className="font-mono text-blue-600">{order?.order_number}</span>
              </div>
              <div className="mt-2 space-y-1">
                <div><span className="text-slate-500">Mijoz:</span> {order?.customer_name} ({order?.customer_phone})</div>
                <div><span className="text-slate-500">Muddat:</span> {formatDate(order?.start_date || '')} — {order?.expected_return_date ? formatDate(order.expected_return_date) : 'Kelishilgan'}</div>
                <div><span className="text-slate-500">Asboblar soni:</span> {items.length} ta</div>
                <div><span className="text-slate-500">Jami ijara:</span> <strong className="text-slate-900">{formatCurrency(order?.total_rent_amount || 0)}</strong></div>
                <div><span className="text-slate-500">Garov (Zalog):</span> <strong className="text-amber-700">{formatCurrency(order?.total_deposit_amount || 0)}</strong></div>
                <div><span className="text-slate-500">To'lov usuli:</span> {payType}</div>
              </div>
            </div>
          )}

          {/* Close Button */}
          <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Yopish va davom etish
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
