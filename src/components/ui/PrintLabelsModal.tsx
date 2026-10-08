import { useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { printLabels, type Label, type LabelFormat } from '@/lib/labels';
import { Modal } from '@/components/ui/Modal';

export function PrintLabelsModal({ labels, onClose }: { labels: Label[] | null; onClose: () => void }) {
  const { t } = useApp();
  const [format, setFormat] = useState<LabelFormat>('a4');
  const [printing, setPrinting] = useState(false);

  const doPrint = async () => {
    if (!labels) return;
    setPrinting(true);
    try {
      await printLabels(labels, format);
      onClose();
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Modal open={!!labels} onClose={onClose} title={t('printLabels')} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">{labels?.length ?? 0} {t('selectedCount')}</p>
        <div className="space-y-2">
          {([['a4', 'printA4'], ['label', 'printLabelPrinter']] as const).map(([value, label]) => (
            <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${format === value ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'}`}>
              <input type="radio" name="label-format" checked={format === value} onChange={() => setFormat(value)} className="text-blue-600 focus:ring-blue-500" />
              <span className="text-slate-800 dark:text-slate-200">{t(label)}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-ghost">{t('cancel')}</button>
          <button onClick={doPrint} disabled={printing} className="btn-primary">
            {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} {t('print')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
