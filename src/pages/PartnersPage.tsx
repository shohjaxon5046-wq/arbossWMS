import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Truck, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { normalizePhone } from '@/lib/format';
import { SERVICE_CATEGORIES } from '@/lib/orders';
import { LoadingSpinner, ErrorState, EmptyState, PageHeader } from '@/components/ui/States';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import type { ServicePartner } from '@/types';

export function PartnersPage({ initialSearch }: { initialSearch?: string }) {
  const { t } = useApp();
  const [partners, setPartners] = useState<ServicePartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(initialSearch ?? '');
  const [partnerModal, setPartnerModal] = useState(false);
  const [editing, setEditing] = useState<ServicePartner | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletePartner, setDeletePartner] = useState<ServicePartner | null>(null);

  const emptyPartnerForm = { company_name: '', service_category: 'avtokran', phone_primary: '', phone_secondary: '', notes: '', is_available: true };
  const [partnerForm, setPartnerForm] = useState(emptyPartnerForm);

  const loadData = useCallback(async () => {
    const { data, error: err } = await supabase.from('erp_service_partners').select('*').order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setPartners((data || []) as ServicePartner[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openAddPartner = () => {
    setEditing(null);
    setPartnerForm(emptyPartnerForm);
    setPartnerModal(true);
  };

  const openEditPartner = (p: ServicePartner) => {
    setEditing(p);
    setPartnerForm({
      company_name: p.company_name, service_category: p.service_category,
      phone_primary: p.phone_primary, phone_secondary: p.phone_secondary,
      notes: p.notes, is_available: p.is_available,
    });
    setPartnerModal(true);
  };

  const handleSavePartner = async () => {
    if (!partnerForm.company_name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        company_name: partnerForm.company_name.trim(),
        service_category: partnerForm.service_category,
        phone_primary: partnerForm.phone_primary.trim(),
        phone_secondary: partnerForm.phone_secondary.trim(),
        notes: partnerForm.notes.trim(),
        is_available: partnerForm.is_available,
        status: partnerForm.is_available ? 'bosh' : 'band',
      };
      if (editing) {
        const { error: updateError } = await supabase.from('erp_service_partners').update(payload).eq('id', editing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('erp_service_partners').insert(payload);
        if (insertError) throw insertError;
      }
      setPartnerModal(false);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePartner = async () => {
    if (!deletePartner) return;
    try {
      const { error: delError } = await supabase.from('erp_service_partners').delete().eq('id', deletePartner.id);
      if (delError) throw delError;
      setDeletePartner(null);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete error');
    }
  };

  const filteredPartners = partners.filter(p => {
    const q = search.toLowerCase();
    return p.company_name.toLowerCase().includes(q) || p.service_category.toLowerCase().includes(q);
  });

  if (loading) return <LoadingSpinner text={t('loading')} />;
  if (error) return <ErrorState message={error} />;

  const categoryOptions = SERVICE_CATEGORIES.map(c => ({ value: c.value, label: t(c.labelKey) }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('partners')}
        action={<button onClick={openAddPartner} className="btn-primary"><Plus className="h-4 w-4" /> {t('addPartner')}</button>}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="input-field pl-9" />
      </div>

      {filteredPartners.length === 0 ? (
          <EmptyState icon={<Truck className="h-12 w-12 text-slate-300 dark:text-slate-600" />} title={t('noData')}
            action={<button onClick={openAddPartner} className="btn-primary"><Plus className="h-4 w-4" /> {t('addPartner')}</button>} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPartners.map(p => (
              <div key={p.id} className="card card-hover p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditPartner(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeletePartner(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">{p.company_name}</h3>
                <p className="text-xs text-slate-400">{categoryOptions.find(c => c.value === p.service_category)?.label || p.service_category}</p>
                <div className="mt-3 space-y-1">
                  <p className="text-sm text-slate-600 dark:text-slate-300">{normalizePhone(p.phone_primary) || '—'}</p>
                  {p.phone_secondary && <p className="text-sm text-slate-400">{normalizePhone(p.phone_secondary)}</p>}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                  <span className="flex items-center gap-1">
                    <span className={`h-2 w-2 rounded-full ${p.is_available ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className="text-xs font-medium">{p.is_available ? t('available2') : t('busy')}</span>
                  </span>
                  <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">★ {p.rating || 5}</span>
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Partner Modal */}
      <Modal open={partnerModal} onClose={() => setPartnerModal(false)} title={editing ? t('editPartner') : t('addPartner')}>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('companyName')}</label>
            <input value={partnerForm.company_name} onChange={e => setPartnerForm({ ...partnerForm, company_name: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('serviceCategory')}</label>
            <select value={partnerForm.service_category} onChange={e => setPartnerForm({ ...partnerForm, service_category: e.target.value })} className="input-field">
              {categoryOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('phonePrimary')}</label>
              <input value={partnerForm.phone_primary} onChange={e => setPartnerForm({ ...partnerForm, phone_primary: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('phoneSecondary')}</label>
              <input value={partnerForm.phone_secondary} onChange={e => setPartnerForm({ ...partnerForm, phone_secondary: e.target.value })} className="input-field" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('description')}</label>
            <textarea value={partnerForm.notes} onChange={e => setPartnerForm({ ...partnerForm, notes: e.target.value })} className="input-field min-h-[60px]" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={partnerForm.is_available} onChange={e => setPartnerForm({ ...partnerForm, is_available: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <span className="text-sm text-slate-700 dark:text-slate-300">{t('available2')}</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setPartnerModal(false)} className="btn-ghost">{t('cancel')}</button>
            <button onClick={handleSavePartner} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('save')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deletePartner}
        onClose={() => setDeletePartner(null)}
        onConfirm={handleDeletePartner}
        title={t('delete')}
        message={`${deletePartner?.company_name || ''}?`}
      />
    </div>
  );
}
