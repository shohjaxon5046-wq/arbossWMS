import { useState } from 'react';
import { ScanLine } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { QrScanner } from '@/components/inbound/QrScanner';
import { parseScannedShelf } from '@/lib/inbound';
import type { WarehouseLocation } from '@/types';

interface ShelfPickerProps {
  locations: WarehouseLocation[];
  value: string;
  onChange: (locationId: string) => void;
}

export function ShelfPicker({ locations, value, onChange }: ShelfPickerProps) {
  const { t } = useApp();
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState('');
  const active = locations.filter(l => l.is_active);

  const handleScan = (raw: string) => {
    const code = parseScannedShelf(raw);
    const match = active.find(l => l.code === code);
    if (!match) {
      setScanError(`${t('shelfNotFound')}: ${code}`);
      return;
    }
    onChange(match.id);
    setScanError('');
    setScanOpen(false);
  };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('shelf')}</label>
      <div className="flex gap-2">
        <select value={value} onChange={e => onChange(e.target.value)} className="input-field font-mono">
          <option value="">{t('selectShelf')}</option>
          {active.map(l => <option key={l.id} value={l.id}>{l.code}{l.description ? ` — ${l.description}` : ''}</option>)}
        </select>
        <button type="button" onClick={() => { setScanError(''); setScanOpen(true); }} className="btn-secondary flex-shrink-0" title={t('scanShelf')}>
          <ScanLine className="h-4 w-4" />
          <span className="hidden sm:inline">{t('scan')}</span>
        </button>
      </div>
      <QrScanner open={scanOpen} onClose={() => setScanOpen(false)} onResult={handleScan} error={scanError} />
    </div>
  );
}
