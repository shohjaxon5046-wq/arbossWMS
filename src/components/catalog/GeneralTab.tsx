import { useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { isValidImage, modelImageUrl, ordersErrorKey, uploadImage } from '@/lib/orders';
import { FieldLabel } from '@/components/inbound/InlineNotice';
import { SPEC_FIELDS, type ModelForm } from '@/components/catalog/modelForm';
import type { Category } from '@/types';

interface Props {
  form: ModelForm;
  setForm: (f: ModelForm) => void;
  categories: Category[];
  onCategoryAdded: (c: Category) => void;
  onError: (msg: string) => void;
}

export function GeneralTab({ form, setForm, categories, onCategoryAdded, onError }: Props) {
  const { t } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!isValidImage(file)) { onError(t('catImageTooLarge')); return; }
    setUploading(true);
    try {
      const path = await uploadImage('model-images', file);
      setForm({ ...form, image_url: path });
    } catch (err) {
      onError(t(ordersErrorKey(err)));
    } finally {
      setUploading(false);
    }
  };

  const saveCategory = async () => {
    const name = newCat.trim();
    if (!name) return;
    const existing = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setForm({ ...form, category: existing.name });
      setAddingCat(false); setNewCat('');
      return;
    }
    setSavingCat(true);
    const { data, error } = await supabase.from('erp_categories').insert({ name }).select().maybeSingle();
    setSavingCat(false);
    if (error || !data) { onError(t(ordersErrorKey(error))); return; }
    onCategoryAdded(data as Category);
    setForm({ ...form, category: name });
    setAddingCat(false); setNewCat('');
  };

  const imgUrl = modelImageUrl(form.image_url);
  const categoryNames = categories.map(c => c.name);
  if (form.category && !categoryNames.includes(form.category)) categoryNames.unshift(form.category);

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <div>
        <FieldLabel>{t('catPhoto')}</FieldLabel>
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => !imgUrl && fileRef.current?.click()}
          className={`group relative flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors ${dragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 bg-slate-50 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-800/50'}`}
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          ) : imgUrl ? (
            <>
              <img src={imgUrl} alt={form.name} className="h-full w-full object-contain p-2" />
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-950/50 opacity-0 transition-opacity group-hover:opacity-100">
                <button type="button" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }} className="rounded-lg bg-white p-2 text-slate-700 shadow hover:text-blue-600" aria-label={t('catPhoto')}>
                  <ImagePlus className="h-4 w-4" />
                </button>
                <button type="button" onClick={e => { e.stopPropagation(); setForm({ ...form, image_url: '' }); }} className="rounded-lg bg-white p-2 text-slate-700 shadow hover:text-red-600" aria-label={t('catRemovePhoto')}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="px-4 text-center">
              <ImagePlus className="mx-auto h-8 w-8 text-slate-400 transition-transform group-hover:scale-110" />
              <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">{t('catDropPhoto')}</p>
              <p className="mt-1 text-[11px] text-slate-400">{t('catPhotoHint')}</p>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      <div className="space-y-4">
        <div>
          <FieldLabel>{t('name')} *</FieldLabel>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Bosch GBH 2-26 DRE" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>{t('brand')}</FieldLabel>
            <input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} className="input-field" placeholder="Bosch" />
          </div>
          <div>
            <FieldLabel>{t('catModelCode')}</FieldLabel>
            <input value={form.model_code} onChange={e => setForm({ ...form, model_code: e.target.value })} className="input-field font-mono" placeholder="GBH-226" />
          </div>
        </div>
        <div>
          <FieldLabel>{t('catCategory')}</FieldLabel>
          {addingCat ? (
            <div className="flex gap-2">
              <input autoFocus value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveCategory(); } }} className="input-field" placeholder={t('catNewCategory')} />
              <button type="button" onClick={saveCategory} disabled={savingCat || !newCat.trim()} className="btn-primary px-3" aria-label={t('save')}>
                {savingCat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => { setAddingCat(false); setNewCat(''); }} className="btn-ghost px-3" aria-label={t('cancel')}><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="input-field">
                <option value="">—</option>
                {categoryNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <button type="button" onClick={() => setAddingCat(true)} className="btn-secondary whitespace-nowrap px-3">
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">{t('catNewCategory')}</span>
              </button>
            </div>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('catSpecs')}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {SPEC_FIELDS.map(s => (
              <div key={s.key}>
                <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">{t(s.labelKey)}</label>
                <input value={form.specs[s.key] ?? ''} onChange={e => setForm({ ...form, specs: { ...form.specs, [s.key]: e.target.value } })} className="input-field py-2 text-sm" placeholder={s.placeholder} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel>{t('description')}</FieldLabel>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field min-h-[64px]" />
        </div>
      </div>
    </div>
  );
}
