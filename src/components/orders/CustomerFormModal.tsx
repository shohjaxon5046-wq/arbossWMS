import { useRef, useState } from 'react';
import { AlertTriangle, Camera, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { Modal } from '@/components/ui/Modal';
import { FieldLabel, InlineNotice, type Notice } from '@/components/inbound/InlineNotice';
import { isValidImage, ordersErrorKey, uploadImage } from '@/lib/orders';
import type { Customer } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
  initialQuery?: string;
}

const empty = { full_name: '', phone_primary: '+998 ', phone_secondary: '', passport_series: '', passport_number: '', address: '' };

export function CustomerFormModal({ open, onClose, onCreated, initialQuery }: Props) {
  const { t } = useApp();
  const [form, setForm] = useState(empty);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [duplicate, setDuplicate] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [lastOpen, setLastOpen] = useState(false);

  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      const q = (initialQuery ?? '').trim();
      const looksLikePhone = /^[+\d\s()-]{5,}$/.test(q);
      setForm({ ...empty, full_name: looksLikePhone ? '' : q, phone_primary: looksLikePhone ? q : empty.phone_primary });
      setPhoto(null);
      setDuplicate(null);
      setNotice(null);
    }
  }

  const set = (k: keyof typeof empty, v: string) => setForm(f => ({ ...f, [k]: v }));
  const digits = (s: string) => s.replace(/\D/g, '');

  const checkDuplicate = async () => {
    const phone = form.phone_primary.trim();
    if (digits(phone).length < 9) { setDuplicate(null); return; }
    const { data } = await supabase.from('erp_customers').select('*')
      .eq('phone_primary', phone).limit(1).maybeSingle();
    setDuplicate((data as Customer | null) ?? null);
  };

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    if (!isValidImage(file)) { setNotice({ kind: 'error', text: t('catImageTooLarge') }); return; }
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    if (!form.full_name.trim() || digits(form.phone_primary).length < 9) return;
    setSaving(true);
    setNotice(null);
    try {
      const photoPath = photo ? await uploadImage('customer-docs', photo) : '';
      const { data, error } = await supabase.from('erp_customers').insert({
        full_name: form.full_name.trim(),
        phone_primary: form.phone_primary.trim(),
        phone_secondary: form.phone_secondary.trim(),
        passport_series: form.passport_series.trim().toUpperCase(),
        passport_number: form.passport_number.trim(),
        passport_photo_url: photoPath,
        address: form.address.trim(),
        source: 'manual',
      }).select('*').single();
      if (error) throw error;
      onCreated(data as Customer);
    } catch (err) {
      setNotice({ kind: 'error', text: t(ordersErrorKey(err)) });
    } finally {
      setSaving(false);
    }
  };

  const valid = form.full_name.trim().length > 1 && digits(form.phone_primary).length >= 9;

  return (
    <Modal open={open} onClose={onClose} title={t('ordNewCustomer')} size="lg">
      <div className="space-y-4">
        <InlineNotice notice={notice} onClose={() => setNotice(null)} />
        <div>
          <FieldLabel>{t('custFullName')} *</FieldLabel>
          <input autoFocus value={form.full_name} onChange={e => set('full_name', e.target.value)} className="input-field" maxLength={120} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>{t('custPhone')} *</FieldLabel>
            <input value={form.phone_primary} onChange={e => set('phone_primary', e.target.value)} onBlur={checkDuplicate}
              className="input-field" inputMode="tel" maxLength={20} />
          </div>
          <div>
            <FieldLabel>{t('custPhone2')}</FieldLabel>
            <input value={form.phone_secondary} onChange={e => set('phone_secondary', e.target.value)} className="input-field" inputMode="tel" maxLength={20} />
          </div>
        </div>

        {duplicate && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1">{t('custDuplicate')}: <b>{duplicate.full_name}</b></span>
            <button onClick={() => onCreated(duplicate)} className="btn-secondary !py-1 text-xs">{t('custUseExisting')}</button>
          </div>
        )}

        <div>
          <FieldLabel>{t('custPassport')}</FieldLabel>
          <div className="grid grid-cols-[88px_1fr] gap-3">
            <input value={form.passport_series} onChange={e => set('passport_series', e.target.value.toUpperCase().slice(0, 2))}
              className="input-field" placeholder="AA" maxLength={2} />
            <input value={form.passport_number} onChange={e => set('passport_number', e.target.value.replace(/\D/g, '').slice(0, 7))}
              className="input-field" placeholder="1234567" inputMode="numeric" />
          </div>
        </div>

        <div>
          <FieldLabel>{t('custPassportPhoto')}</FieldLabel>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden"
            onChange={e => { pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
          {photo ? (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
              <img src={preview} alt="" className="h-16 w-24 rounded-md object-cover" />
              <span className="flex-1 truncate text-sm text-slate-600 dark:text-slate-300">{photo.name}</span>
              <button onClick={() => setPhoto(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 py-4 text-sm text-slate-500 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400">
              <Camera className="h-4 w-4" /> {t('custUploadPhoto')}
            </button>
          )}
        </div>

        <div>
          <FieldLabel>{t('custAddress')}</FieldLabel>
          <input value={form.address} onChange={e => set('address', e.target.value)} className="input-field" maxLength={300} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-ghost">{t('cancel')}</button>
          <button onClick={save} disabled={saving || !valid} className="btn-primary">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} {t('custSaveAndSelect')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
