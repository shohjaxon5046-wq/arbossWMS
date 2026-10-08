import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Users, Loader2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { normalizePhone } from '@/lib/format';
import { LoadingSpinner, ErrorState, EmptyState, PageHeader } from '@/components/ui/States';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import type { Staff, UserRole } from '@/types';

export function StaffPage() {
  const { t } = useApp();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);

  const emptyForm = { full_name: '', phone: '', email: '', role: 'seller' as UserRole, is_active: true };
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    try {
      const { data, error: queryError } = await supabase
        .from('erp_staff')
        .select('*')
        .order('created_at', { ascending: false });
      if (queryError) throw queryError;
      setStaff((data || []) as Staff[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (s: Staff) => {
    setEditing(s);
    setForm({ full_name: s.full_name, phone: s.phone, email: s.email, role: s.role, is_active: s.is_active });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        role: form.role,
        is_active: form.is_active,
      };
      if (editing) {
        const { error: updateError } = await supabase.from('erp_staff').update(payload).eq('id', editing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('erp_staff').insert(payload);
        if (insertError) throw insertError;
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error: delError } = await supabase.from('erp_staff').delete().eq('id', deleteTarget.id);
      if (delError) throw delError;
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete error');
    }
  };

  const filtered = staff.filter(s => {
    const q = search.toLowerCase();
    return s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.phone.includes(q);
  });

  const roleOptions: { value: UserRole; label: string }[] = [
    { value: 'admin', label: t('admin') },
    { value: 'manager', label: t('manager') },
    { value: 'seller', label: t('seller') },
    { value: 'cashier', label: t('cashier') },
    { value: 'warehouse', label: t('warehouseWorker') },
  ];

  if (loading) return <LoadingSpinner text={t('loading')} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('staffManagement')}
        action={<button onClick={openAdd} className="btn-primary"><Plus className="h-4 w-4" /> {t('addStaff')}</button>}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="input-field pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-12 w-12 text-slate-300 dark:text-slate-600" />} title={t('noData')}
          action={<button onClick={openAdd} className="btn-primary"><Plus className="h-4 w-4" /> {t('addStaff')}</button>} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="table-header">{t('fullName')}</th>
                  <th className="table-header">{t('phone')}</th>
                  <th className="table-header">{t('email')}</th>
                  <th className="table-header">{t('role')}</th>
                  <th className="table-header">{t('status')}</th>
                  <th className="table-header text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="table-cell font-medium">{s.full_name}</td>
                    <td className="table-cell">{normalizePhone(s.phone) || '—'}</td>
                    <td className="table-cell text-slate-500">{s.email || '—'}</td>
                    <td className="table-cell">
                      <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {roleOptions.find(r => r.value === s.role)?.label || s.role}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${s.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                        {s.is_active ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('editStaff') : t('addStaff')}>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('fullName')}</label>
            <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('phone')}</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('email')}</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('role')}</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as UserRole })} className="input-field">
              {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <span className="text-sm text-slate-700 dark:text-slate-300">{t('isActive')}</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-ghost">{t('cancel')}</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('save')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('delete')}
        message={`${deleteTarget?.full_name || ''}?`}
      />
    </div>
  );
}
