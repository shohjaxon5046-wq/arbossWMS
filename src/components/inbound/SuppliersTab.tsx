import { useState } from 'react';
import { Plus, Pencil, Trash2, Building, Phone, User, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { inboundErrorKey } from '@/lib/inbound';
import { normalizePhone } from '@/lib/format';
import { EmptyState } from '@/components/ui/States';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { InlineNotice, FieldLabel, type Notice } from '@/components/inbound/InlineNotice';
import type { InboundData, Supplier } from '@/types';

interface Props {
  data: InboundData;
  canManage: boolean;
  reload: () => Promise<void>;
}

const emptyForm = { name: '', contact_person: '', phone: '', address: '', notes: '' };

export function SuppliersTab({ data, canManage, reload }: Props) {
  const { t } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setFormError(''); setModalOpen(true); };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, contact_person: s.contact_person, phone: s.phone, address: s.address, notes: s.notes });
    setFormError('');
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { setFormError(t('fillingFields')); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      contact_person: form.contact_person.trim(),
      phone: normalizePhone(form.phone.trim()),
      address: form.address.trim(),
      notes: form.notes.trim(),
      updated_at: new Date().toISOString(),
    };
    const { error } = editing
      ? await supabase.from('erp_suppliers').update(payload).eq('id', editing.id)
      : await supabase.from('erp_suppliers').insert(payload);
    setSaving(false);
    if (error) { setFormError(t(inboundErrorKey(error))); return; }
    setModalOpen(false);
    await reload();
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('erp_suppliers').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    if (error) { setNotice({ kind: 'error', text: t(inboundErrorKey(error)) }); return; }
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">{data.suppliers.length} {t('tabSuppliers').toLowerCase()}</p>
        {canManage && <button onClick={openAdd} className="btn-primary"><Plus className="h-4 w-4" /> {t('addSupplier')}</button>}
      </div>
      <InlineNotice notice={notice} onClose={() => setNotice(null)} />

      {data.suppliers.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Building className="h-12 w-12 text-slate-300 dark:text-slate-600" />}
            title={t('noSuppliers')}
            action={canManage ? <button onClick={openAdd} className="btn-primary"><Plus className="h-4 w-4" /> {t('addSupplier')}</button> : undefined}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.suppliers.map(s => {
            const orders = data.orders.filter(o => o.supplier_id === s.id).length;
            const returns = data.returns.filter(r => r.supplier_id === s.id).length;
            return (
              <div key={s.id} className="card card-hover group p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                      <Building className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{s.name}</p>
                      {s.address && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{s.address}</p>}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                      <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteTarget(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                  {s.contact_person && <p className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-slate-400" /> {s.contact_person}</p>}
                  {s.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" /> <a href={`tel:${s.phone.replace(/[^\d+]/g, '')}`} className="hover:text-blue-600">{s.phone}</a></p>}
                </div>
                <div className="mt-4 flex gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <span><b className="text-slate-800 dark:text-slate-100">{orders}</b> {t('supplierOrders').toLowerCase()}</span>
                  <span><b className="text-slate-800 dark:text-slate-100">{returns}</b> {t('supplierReturns').toLowerCase()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('editSupplier') : t('addSupplier')}>
        <div className="space-y-4">
          <div><FieldLabel>{t('name')} *</FieldLabel><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><FieldLabel>{t('contactPerson')}</FieldLabel><input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} className="input-field" /></div>
            <div><FieldLabel>{t('phone')}</FieldLabel><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" placeholder="+998 90 123-45-67" /></div>
          </div>
          <div><FieldLabel>{t('fieldAddress')}</FieldLabel><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="input-field" /></div>
          <div><FieldLabel>{t('fieldNotes')}</FieldLabel><textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input-field" /></div>
          {formError && <InlineNotice notice={{ kind: 'error', text: formError }} onClose={() => setFormError('')} />}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-ghost">{t('cancel')}</button>
            <button onClick={save} disabled={saving} className="btn-primary">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{t('save')}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={remove} title={t('delete')} message={`${deleteTarget?.name ?? ''}?`} />
    </div>
  );
}
