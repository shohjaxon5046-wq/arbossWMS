import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import type { ModelForm } from '@/components/catalog/modelForm';

function ChipInput({ title, values, onChange, tone }: { title: string; values: string[]; onChange: (v: string[]) => void; tone: 'blue' | 'amber' }) {
  const { t } = useApp();
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !values.some(x => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft('');
  };
  const chip = tone === 'blue'
    ? 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-800'
    : 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800';

  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <p className="mb-3 text-sm font-medium text-slate-800 dark:text-slate-200">{title}</p>
      <div className="mb-3 flex min-h-[32px] flex-wrap gap-2">
        {values.map(v => (
          <span key={v} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ring-1 animate-fade-in ${chip}`}>
            {v}
            <button type="button" onClick={() => onChange(values.filter(x => x !== v))} className="rounded-full p-0.5 opacity-60 hover:opacity-100" aria-label={t('delete')}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} className="input-field py-2 text-sm" placeholder={t('catChipPlaceholder')} />
        <button type="button" onClick={add} disabled={!draft.trim()} className="btn-secondary whitespace-nowrap px-3 text-sm"><Plus className="h-4 w-4" /> {t('catAddChip')}</button>
      </div>
    </div>
  );
}

export function KitTab({ form, setForm }: { form: ModelForm; setForm: (f: ModelForm) => void }) {
  const { t } = useApp();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ChipInput title={t('catKitItems')} values={form.kit_items} onChange={v => setForm({ ...form, kit_items: v })} tone="blue" />
      <ChipInput title={t('catConsumables')} values={form.consumables} onChange={v => setForm({ ...form, consumables: v })} tone="amber" />
    </div>
  );
}
