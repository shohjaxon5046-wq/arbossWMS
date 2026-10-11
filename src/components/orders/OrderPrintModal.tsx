import { useEffect, useState, useRef } from 'react';
import { 
  Printer, FileText, CheckCircle2, Loader2, AlertCircle, 
  ExternalLink, Download, Copy, Check, Eye, EyeOff, RefreshCw, X 
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { loadOrderBundle } from '@/lib/orders';
import { 
  printCashReceipt80mm, printContractA4, 
  generateCashReceipt80mmHtml, generateContractA4Html, 
  getCashReceiptPlainText 
} from '@/lib/receipt';
import { openHtmlInNewTab, downloadHtmlFile } from '@/lib/labels';
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
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewMode, setPreviewMode] = useState<ReceiptType | null>(null);

  // Load bundle data as soon as modal opens
  useEffect(() => {
    if (open && orderId) {
      setLoading(true);
      setError('');
      setActivePrintType(null);
      setPreviewHtml('');
      setPreviewMode(null);
      
      loadOrderBundle(orderId)
        .then(b => {
          setBundle(b);
        })
        .catch(err => {
          console.error('Failed to load order bundle for printing:', err);
          setError('Buyurtma ma\'lumotlarini yuklashda xatolik yuz berdi');
        })
        .finally(() => setLoading(false));
    } else {
      setBundle(null);
      setActivePrintType(null);
      setPreviewHtml('');
      setPreviewMode(null);
    }
  }, [open, orderId]);

  if (!open || !orderId) return null;

  // Safe and resilient print handler
  const handlePrintReceipt = async (receiptType: ReceiptType) => {
    setError('');
    setActivePrintType(receiptType);
    setPrinting(true);

    try {
      let b = bundle;
      if (!b) {
        b = await loadOrderBundle(orderId);
        setBundle(b);
      }

      // Generate HTML for both preview and printing
      const html = receiptType === 'simple'
        ? await generateCashReceipt80mmHtml(b)
        : await generateContractA4Html(b);

      setPreviewHtml(html);
      setPreviewMode(receiptType);

      // Trigger standard print mechanism
      if (receiptType === 'simple') {
        await printCashReceipt80mm(b);
      } else {
        await printContractA4(b);
      }

      // Safe secondary trigger for browsers needing DOM sync
      setTimeout(() => {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.warn('Direct window.print notice:', e);
        } finally {
          setPrinting(false);
        }
      }, 200);
    } catch (err: any) {
      console.error('Print receipt error:', err);
      setError(err?.message || 'Chop etishda xatolik yuz berdi');
      setPrinting(false);
    }
  };

  // Open in dedicated clean window/tab (Guaranteed to bypass iframe sandbox restrictions)
  const handleOpenNewTab = async () => {
    if (!bundle) return;
    try {
      const type = previewMode || activePrintType || 'simple';
      const html = type === 'simple'
        ? await generateCashReceipt80mmHtml(bundle)
        : await generateContractA4Html(bundle);
      openHtmlInNewTab(html);
    } catch (err: any) {
      setError('Alohida oynada ochishda xatolik yuz berdi');
    }
  };

  // Download printable HTML file
  const handleDownload = async () => {
    if (!bundle) return;
    try {
      const type = previewMode || activePrintType || 'simple';
      const html = type === 'simple'
        ? await generateCashReceipt80mmHtml(bundle)
        : await generateContractA4Html(bundle);
      const filename = `${type === 'simple' ? 'Kassa_Cheki' : 'Ijara_Shartnomasi'}_${bundle.order.order_number}.html`;
      downloadHtmlFile(html, filename);
    } catch (err: any) {
      setError('Faylni yuklab olishda xatolik yuz berdi');
    }
  };

  // Copy plain text receipt for Telegram/SMS
  const handleCopyText = () => {
    if (!bundle) return;
    const txt = getCashReceiptPlainText(bundle);
    navigator.clipboard.writeText(txt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      setError('Nusxa olishda xatolik yuz berdi');
    });
  };

  const order = bundle?.order;
  const items = bundle?.items || [];
  const payments = bundle?.payments || [];
  const payType = payments.length ? payments.map(p => p.payment_type).join(', ') : 'Naqd';

  return (
    <Modal open={open} onClose={onClose} title="Buyurtma tasdiqlandi — Chek chiqarish" size={previewMode ? 'xl' : 'md'} zIndex="z-[70]">
      <div className="space-y-4">
        {/* Header summary */}
        <div className="flex items-center gap-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-3.5">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-900 truncate">
              Buyurtma muvaffaqiyatli saqlandi!
            </h3>
            <p className="text-xs text-slate-600 mt-0.5 truncate">
              Mijoz: <strong className="text-slate-800">{order?.customer_name || '—'}</strong> | Buyurtma: <span className="font-mono font-semibold text-blue-700">{order?.order_number || '—'}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyText}
            title="Chek matnini Telegram uchun nusxalash"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
            <span className="hidden sm:inline">{copied ? 'Nusxalandi!' : 'Nusxa olish'}</span>
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 2 Primary Action Buttons: Exactly as requested */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Button 1: Oddiy kassa cheki (80mm) */}
          <button
            type="button"
            onClick={() => handlePrintReceipt('simple')}
            disabled={loading || printing}
            className={`group relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 text-center transition-all disabled:opacity-50 ${
              activePrintType === 'simple'
                ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/20'
                : 'border-blue-200 bg-blue-50/40 hover:border-blue-500 hover:bg-blue-100/60 hover:shadow-md'
            }`}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition-transform group-hover:scale-105">
              {printing && activePrintType === 'simple' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Printer className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">[ 🧾 Oddiy chek chiqarish ]</p>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">80mm termoprinter uchun</p>
            </div>
            <span className="inline-block rounded-md bg-blue-600/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              Kassa cheki
            </span>
          </button>

          {/* Button 2: Shartnoma bilan chiqarish (A4) */}
          <button
            type="button"
            onClick={() => handlePrintReceipt('contract')}
            disabled={loading || printing}
            className={`group relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-4 text-center transition-all disabled:opacity-50 ${
              activePrintType === 'contract'
                ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600/20'
                : 'border-indigo-200 bg-indigo-50/40 hover:border-indigo-500 hover:bg-indigo-100/60 hover:shadow-md'
            }`}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition-transform group-hover:scale-105">
              {printing && activePrintType === 'contract' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FileText className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">[ 📄 Shartnoma bilan chiqarish (A4) ]</p>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">A4 to'liq yuridik shartnoma</p>
            </div>
            <span className="inline-block rounded-md bg-indigo-600/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
              Qabul-topshirish akti
            </span>
          </button>
        </div>

        {/* Live Preview Area & Extra Tools */}
        {previewMode && previewHtml && (
          <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            {/* Toolbar for the previewed receipt */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                  {previewMode === 'simple' ? '🧾 80mm Kassa cheki' : '📄 A4 Ijara shartnomasi'}
                </span>
                <span className="text-xs text-slate-500">
                  (Printer ochilmasa, pastdagi tugmalardan foydalaning)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePrintReceipt(previewMode)}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                  title="Qayta chop etish"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Chop etish</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  title="Alohida toza oynada ochish va chop etish"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                  <span>Yangi oynada</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  title="HTML formatida yuklab olish"
                >
                  <Download className="h-3.5 w-3.5 text-slate-500" />
                  <span>Yuklab olish</span>
                </button>
              </div>
            </div>

            {/* Embedded Sandbox Safe Preview iframe */}
            <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-inner">
              <iframe
                title="Chek ko'rinishi"
                srcDoc={previewHtml}
                className="w-full bg-white"
                style={{
                  height: previewMode === 'simple' ? '380px' : '460px',
                  border: 'none',
                }}
              />
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <p className="text-[11px] text-slate-500">
            Jami ijara: <strong className="text-slate-800">{formatCurrency(order?.total_rent_amount || 0)}</strong>
            {Number(order?.total_deposit_amount) > 0 && (
              <> | Garov: <strong className="text-amber-700">{formatCurrency(order?.total_deposit_amount || 0)}</strong></>
            )}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            Yopish va davom etish
          </button>
        </div>
      </div>
    </Modal>
  );
}
