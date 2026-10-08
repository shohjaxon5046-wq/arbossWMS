import { useEffect, useMemo, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency } from '@/lib/format';

export interface CrudColumn {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'money' | 'boolean' | 'select';
  options?: { value: string; label: string }[];
  required?: boolean;
  shownInForm?: boolean;
}

interface Props {
  rows: Record<string, unknown>[];
  columns: CrudColumn[];
  onSave: (id: string | null, values: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function cellText(col: CrudColumn, value: unknown): string {
  if (col.type === 'money') return formatCurrency(Number(value ?? 0));
  if (col.type === 'boolean') return value ? 'Faol' : 'Nofaol';
  if (col.type === 'select') {
    return col.options?.find(o => o.value === String(value))?.label ?? String(value ?? '');
  }
  return String(value ?? '');
}

export function CrudTable({ rows, columns, onSave, onDelete }: Props) {
  const { t } = useApp();
  const [editing, setEditing] = useState<{ id: string | null; initial: Record<string, unknown> } | null>(null);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
        <button onClick={() => setEditing({ id: null, initial: {} })} className="btn-primary"><Plus className="h-4 w-4" /> {t('addRow')}</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
            <tr>
              {columns.map(c => <th key={c.key} className="table-header">{c.label}</th>)}
              <th className="table-header text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="table-cell text-center text-slate-400">{t('noData')}</td></tr>
            )}
            {rows.map(r => (
              <tr key={String(r.id)} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
                {columns.map(c => {
                  if (c.type === 'boolean') {
                    const active = Boolean(r[c.key]);
                    return (
                      <td key={c.key} className="table-cell">
                        <button
                          onClick={() => onSave(String(r.id), { [c.key]: !active })}
                          className={`badge cursor-pointer ${active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}
                        >
                          {active ? t('active') : t('inactive')}
                        </button>
                      </td>
                    );
                  }
                  return <td key={c.key} className="table-cell">{cellText(c, r[c.key])}</td>;
                })}
                <td className="table-cell">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditing({ id: String(r.id), initial: r })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { if (window.confirm(t('saveConfirm'))) onDelete(String(r.id)); }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <CrudModal
          id={editing.id}
          initial={editing.initial}
          columns={columns}
          onClose={() => setEditing(null)}
          onSave={async (values) => { await onSave(editing.id, values); setEditing(null); }}
        />
      )}
    </div>
  );
}

function CrudModal({ id, initial, columns, onClose, onSave }: {
  id: string | null;
  initial: Record<string, unknown>;
  columns: CrudColumn[];
  onClose: () => void;
  onSave: (values: Record<string, unknown>) => Promise<void>;
}) {
  const { t } = useApp();
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init: Record<string, string | boolean> = {};
    for (const c of columns) {
      const v = initial[c.key];
      init[c.key] = c.type === 'boolean' ? Boolean(v) : String(v ?? '');
    }
    setForm(init);
  }, [columns, initial]);

  const onSubmit = async () => {
    setSaving(true);
    const values: Record<string, unknown> = {};
    for (const c of columns) {
      if (!c.shownInForm && id !== null) continue;
      const raw = form[c.key];
      if (c.type === 'number' || c.type === 'money') values[c.key] = Number(raw) || 0;
      else if (c.type === 'boolean') values[c.key] = Boolean(raw);
      else values[c.key] = typeof raw === 'string' ? raw.trim() : raw;
      if (c.required && (raw === '' || raw === false)) {
        setSaving(false);
        window.alert(c.label + ': ' + t('fieldRequired'));
        return;
      }
    }
    await onSave(values);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{id ? t('editRow') : t('addRow')}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {columns.filter(c => c.shownInForm !== false || id === null).map(c => (
            <div key={c.key} className={c.type === 'boolean' ? 'sm:col-span-2' : ''}>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{c.label}</label>
              {c.type === 'boolean' ? (
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, [c.key]: !Boolean(f[c.key]) }))}
                  className={`badge cursor-pointer ${form[c.key] ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
                >
                  {form[c.key] ? t('active') : t('inactive')}
                </button>
              ) : c.type === 'select' ? (
                <select value={String(form[c.key])} onChange={e => setForm(f => ({ ...f, [c.key]: e.target.value }))} className="input-field">
                  {c.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input
                  type={c.type === 'number' || c.type === 'money' ? 'number' : 'text'}
                  step={c.type === 'money' ? '1000' : '1'}
                  value={String(form[c.key] ?? '')}
                  onChange={e => setForm(f => ({ ...f, [c.key]: e.target.value }))}
                  className="input-field"
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">{t('cancel')}</button>
          <button onClick={onSubmit} disabled={saving} className="btn-primary disabled:opacity-50">
            <Check className="h-4 w-4" /> {saving ? t('loading') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsEditor({ rows, onSave }: {
  rows: { key: string; value: number }[];
  onSave: (key: string, value: number) => Promise<void>;
}) {
  const { t } = useApp();
  const [values, setValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init: Record<string, number> = {};
    for (const r of rows) init[r.key] = Number(r.value);
    setValues(init);
  }, [rows]);

  const dirty = useMemo(() => {
    const out: [string, number][] = [];
    for (const r of rows) {
      const v = Number(values[r.key]);
      if (v !== Number(r.value)) out.push([r.key, v]);
    }
    return out;
  }, [rows, values]);

  const saveAll = async () => {
    setSaving(true);
    for (const [k, v] of dirty) await onSave(k, v);
    setSaving(false);
  };

  return (
    <div className="card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map(r => (
          <div key={r.key}>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t(`setKey_${r.key}` as never)}</label>
            <input type="number" value={Number(values[r.key]) || 0} onChange={e => setValues(v => ({ ...v, [r.key]: Number(e.target.value) || 0 }))} className="input-field" />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button onClick={saveAll} disabled={saving || dirty.length === 0} className="btn-primary disabled:opacity-50">
          <Check className="h-4 w-4" /> {t('save')}
        </button>
      </div>
    </div>
  );
}
