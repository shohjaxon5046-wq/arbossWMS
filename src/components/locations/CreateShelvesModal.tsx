import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { buildShelfCode, inboundErrorKey, padNumber } from '@/lib/inbound';
import { Modal } from '@/components/ui/Modal';
import { InlineNotice, FieldLabel } from '@/components/inbound/InlineNotice';
import type { WarehouseLocation } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  existing: WarehouseLocation[];
  onCreated: () => Promise<void>;
}

const MAX_BATCH = 200;

export function CreateShelvesModal({ open, onClose, existing, onCreated }: Props) {
  const { t } = useApp();
  const [form, setForm] = useState({ sector: 'A', rack: '01', from: '1', to: '5', capacity: '0', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const preview = useMemo(() => {
    const from = Math.max(1, Math.floor(Number(form.from) || 0));
    const to = Math.floor(Number(form.to) || 0);
    if (!form.sector.trim() || !form.rack.trim() || to < from) return [];
    const width = Math.max(2, String(to).length);
    const taken = new Set(existing.map(l => l.code));
    return Array.from({ length: Math.min(to - from + 1, MAX_BATCH) }, (_, i) => {
      const shelf = padNumber(from + i, width);
      const code = buildShelfCode(form.sector, form.rack, shelf);
      return { shelf, code, exists: taken.has(code) };
    });
  }, [form, existing]);

  const toCreate = preview.filter(p => !p.exists);

  const submit = async () => {
    if (toCreate.length === 0) { setError(t('fillingFields')); return; }
    setSaving(true);
    const { error: err } = await supabase.from('erp_warehouse_locations').insert(toCreate.map(p => ({
      sector: form.sector.trim().toUpperCase(),
      rack: form.rack.trim().toUpperCase(),
      shelf: p.shelf,
      code: p.code,
      capacity: Math.max(0, Math.floor(Number(form.capacity) || 0)),
      description: form.description.trim(),
    })));
    setSaving(false);
    if (err) { setError(t(inboundErrorKey(err))); return; }
    setError('');
    await onCreated();
    onClose();
  };

  const field = (key: keyof typeof form, label: string, type = 'text') => (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input type={type} min={type === 'number' ? 0 : undefined} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className={`input-field ${type === 'text' ? 'uppercase' : ''}`} />
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title={t('createShelves')} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {field('sector', t('sector'))}
          {field('rack', t('rack'))}
          {field('from', t('shelfFrom'), 'number')}
          {field('to', t('shelfTo'), 'number')}
        </div>
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          {field('capacity', t('capacity'), 'number')}
          <div>
            <FieldLabel>{t('description')}</FieldLabel>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" />
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{t('shelvesPreview')}: <b>{toCreate.length}</b></p>
          <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-700">
            {preview.length === 0 ? <span className="text-sm text-slate-400">—</span> : preview.map(p => (
              <span
                key={p.code}
                title={p.exists ? t('shelvesExisting') : undefined}
                className={`rounded-md px-2 py-1 font-mono text-xs ${p.exists
                  ? 'bg-slate-100 text-slate-400 line-through dark:bg-slate-800 dark:text-slate-500'
                  : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}
              >
                {p.code}
              </span>
            ))}
          </div>
          {preview.some(p => p.exists) && <p className="mt-1.5 text-xs text-slate-500">{t('shelvesExisting')}</p>}
        </div>

        {error && <InlineNotice notice={{ kind: 'error', text: error }} onClose={() => setError('')} />}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-ghost">{t('cancel')}</button>
          <button onClick={submit} disabled={saving || toCreate.length === 0} className="btn-primary">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{t('save')}</button>
        </div>
      </div>
    </Modal>
  );
}
