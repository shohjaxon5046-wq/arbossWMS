import { useState } from 'react';
import { Printer, FileText, CheckCircle2, Loader2, X, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { loadOrderBundle } from '@/lib/orders';
import { printCashReceipt80mm, printContractA4 } from '@/lib/receipt';
import { formatCurrency } from '@/lib/format';
import type { OrderBundle } from '@/lib/orders';

interface Props {
  open: boolean;
  orderId: string | null;
  onClose: () => void;
}

export function OrderPrintModal({ open, orderId, onClose }: Props) {
  const [printingType, setPrintingType] = useState<'80mm' | 'a4' | null>(null);
  const [error, setError] = useState('');

  if (!open || !orderId) return null;

  const handlePrint = async (type: '80mm' | 'a4') => {
    setPrintingType(type);
    setError('');
    try {
      const bundle: OrderBundle = await loadOrderBundle(orderId);
      if (type === '80mm') {
        await printCashReceipt80mm(bundle);
      } else {
        await printContractA4(bundle);
      }
    } catch (err: any) {
      console.error('Print error:', err);
      setError(err?.message || 'Chop etishda xatolik yuz berdi');
    } finally {
      setPrintingType(null);
    }
  };

  return (
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
            Iltimos, mijoz uchun kerakli formatdagi chek yoki ijara shartnomasini chop eting.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-left text-xs text-red-600">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 pt-1">
          {/* 80mm Cash Receipt */}
          <button
            type="button"
            onClick={() => handlePrint('80mm')}
            disabled={!!printingType}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-blue-200 bg-blue-50/60 p-5 text-center transition-all hover:border-blue-500 hover:bg-blue-100/60 hover:shadow-md disabled:opacity-50"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              {printingType === '80mm' ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Printer className="h-6 w-6" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">🧾 Oddiy kassa cheki</p>
              <p className="text-[11px] font-medium text-slate-500">80mm termoprinter uchun</p>
            </div>
            <span className="mt-1 inline-block rounded-md bg-blue-600/10 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
              Tezkor kassa cheki
            </span>
          </button>

          {/* A4 Legal Contract */}
          <button
            type="button"
            onClick={() => handlePrint('a4')}
            disabled={!!printingType}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-indigo-200 bg-indigo-50/60 p-5 text-center transition-all hover:border-indigo-500 hover:bg-indigo-100/60 hover:shadow-md disabled:opacity-50"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              {printingType === 'a4' ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <FileText className="h-6 w-6" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">📄 Shartnoma-chek</p>
              <p className="text-[11px] font-medium text-slate-500">A4 to'liq yuridik shartnoma</p>
            </div>
            <span className="mt-1 inline-block rounded-md bg-indigo-600/10 px-2.5 py-1 text-[10px] font-semibold text-indigo-700">
              Qabul-topshirish akti bilan
            </span>
          </button>
        </div>

        {/* Close Button */}
        <div className="border-t border-slate-100 pt-3">
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
  );
}
