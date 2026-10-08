import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Pencil, Trash2, Users, Loader2, Search, KeyRound, FileSpreadsheet, Download, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { normalizePhone, normalizePhoneInput } from '@/lib/format';
import { readFirstSheet, normalizeKeys, downloadStaffTemplate } from '@/lib/excel';
import { LoadingSpinner, ErrorState, EmptyState, PageHeader } from '@/components/ui/States';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import type { Staff, UserRole } from '@/types';

const ROLE_ALIASES: Record<string, UserRole> = {
  admin: 'admin', administrator: 'admin', админ: 'admin',
  manager: 'manager', menejer: 'manager', менеджер: 'manager',
  seller: 'seller', sotuvchi: 'seller', продавец: 'seller',
  cashier: 'cashier', kassir: 'cashier', кассир: 'cashier',
  warehouse: 'warehouse', skladchi: 'warehouse', склад: 'warehouse',
};

const apiCall = async (body: Record<string, unknown>, token: string | undefined) => {
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token ?? ''}`,
      Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, data };
};

export function StaffPage() {
  const { t } = useApp();
  const { session } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [loginTarget, setLoginTarget] = useState<Staff | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<{ full_name: string; email: string; error: string | null }[]>([]);
  const [importDone, setImportDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const emptyForm = { full_name: '', phone: '', email: '', password: '', role: 'seller' as UserRole, is_active: true };
  const [form, setForm] = useState(emptyForm);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

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
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (s: Staff) => {
    setEditing(s);
    setForm({ full_name: s.full_name, phone: s.phone, email: s.email, password: '', role: s.role, is_active: s.is_active });
    setFormError('');
    setModalOpen(true);
  };

  const handleAdd = async () => {
    const fullName = form.full_name.trim();
    const phone = normalizePhoneInput(form.phone);
    if (!fullName || !form.email.trim() || !form.password) {
      setFormError(t('fillingFields'));
      return;
    }
    if (!phone) {
      setFormError(t('phoneRequired'));
      return;
    }
    if (phone.length !== 12 || !phone.startsWith('998')) {
      setFormError(t('phoneInvalid'));
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const { ok, data } = await apiCall({
        full_name: fullName,
        phone,
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
      }, session?.access_token);
      if (!ok) {
        const code = data?.error;
        if (code === 'email_exists') throw new Error(t('emailExists'));
        if (code === 'password_too_short') throw new Error(t('passwordTooShort'));
        if (code === 'invalid_email') throw new Error(t('invalidEmail'));
        throw new Error(t('loginError'));
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('loginError'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!form.full_name.trim()) return;
    const phone = normalizePhoneInput(form.phone);
    if (phone && phone.length !== 12) {
      setSaving(false);
      setFormError(t('phoneInvalid'));
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        full_name: form.full_name.trim(),
        phone: phone || null,
        role: form.role,
        is_active: form.is_active,
      };
      if (editing) {
        const { error: updateError } = await supabase.from('erp_staff').update(payload).eq('id', editing.id);
        if (updateError) throw updateError;
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save error');
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

  const openLogin = (s: Staff) => {
    setLoginTarget(s);
    setLoginForm({ email: s.email || '', password: '' });
    setFormError('');
  };

  const submitLogin = async () => {
    if (!loginTarget) return;
    setSaving(true);
    setFormError('');
    try {
      const { ok, data } = await apiCall({
        action: 'set_login',
        staff_id: loginTarget.id,
        email: loginForm.email.trim().toLowerCase(),
        password: loginForm.password,
      }, session?.access_token);
      if (!ok) {
        const code = data?.error;
        if (code === 'email_exists') throw new Error(t('emailExists'));
        if (code === 'password_too_short') throw new Error(t('passwordTooShort'));
        if (code === 'invalid_email') throw new Error(t('invalidEmail'));
        throw new Error(t('loginError'));
      }
      setLoginTarget(null);
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('loginError'));
    } finally {
      setSaving(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setImportRows([]);
    setImportDone(false);
    setFormError('');
    try {
      const raw = await readFirstSheet(file);
      const rows = normalizeKeys(raw);
      const payload = rows.map((r) => ({
        full_name: r.full_name ?? '',
        phone: normalizePhoneInput(r.phone ?? ''),
        role: ROLE_ALIASES[(r.role ?? '').toLowerCase()] || 'seller',
        email: (r.email ?? '').toLowerCase(),
        password: r.password ?? '',
      })).filter((r) => r.full_name);
      if (payload.length === 0) {
        setFormError(t('noData'));
        return;
      }
      const { ok, data } = await apiCall({ action: 'bulk', rows: payload }, session?.access_token);
      if (!ok) throw new Error(t('loginError'));
      setImportRows(data?.results ?? []);
      setImportDone(true);
      loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('loginError'));
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

  const importOk = importRows.filter(r => !r.error).length;
  const importBad = importRows.filter(r => r.error).length;

  if (loading) return <LoadingSpinner text={t('loading')} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('staffManagement')}
        action={
          <div className="flex gap-2">
            <button onClick={() => { setImportOpen(true); setImportRows([]); setImportDone(false); setFormError(''); }} className="btn-secondary">
              <FileSpreadsheet className="h-4 w-4" /> <span className="hidden sm:inline">{t('importStaff')}</span>
            </button>
            <button onClick={openAdd} className="btn-primary"><Plus className="h-4 w-4" /> {t('addStaff')}</button>
          </div>
        }
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
                  <th className="table-header">{t('telegram')}</th>
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
                      {s.telegram_chat_id ? (
                        <span className="badge bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">{t('tgConnected')}</span>
                      ) : (
                        <span className="text-xs text-slate-400">{t('tgNotConnected')}</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${s.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                        {s.is_active ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openLogin(s)} title={t('editLogin')} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800">
                          <KeyRound className="h-4 w-4" />
                        </button>
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

      {/* Add / edit staff */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('editStaff') : t('addStaff')}>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('fullName')}</label>
            <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('phone')}</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" placeholder="+998901234567" />
              {!editing && <p className="mt-1 text-xs text-slate-400">{t('tgPhoneHint')}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('email')}</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field" disabled={!!editing} />
            </div>
          </div>
          {!editing && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('newPassword')}</label>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="input-field" placeholder={t('passwordHint')} />
              <p className="mt-1 text-xs text-slate-400">{t('loginInfo')}</p>
            </div>
          )}
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

          {formError && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-ghost">{t('cancel')}</button>
            <button onClick={editing ? handleEdit : handleAdd} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Set login */}
      <Modal open={!!loginTarget} onClose={() => setLoginTarget(null)} title={t('editLogin')}>
        {loginTarget && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">{loginTarget.full_name} — {loginTarget.user_id ? '' : t('staffHasNoLogin')}</p>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('email')}</label>
              <input type="email" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{t('newPassword')}</label>
              <input type="password" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} className="input-field" placeholder={t('passwordHint')} />
            </div>
            {formError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{formError}</div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setLoginTarget(null)} className="btn-ghost">{t('cancel')}</button>
              <button onClick={submitLogin} disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('save')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Import staff */}
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title={t('importStaff')} size="lg">
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('importStaffHint')}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={downloadStaffTemplate} className="btn-secondary"><Download className="h-4 w-4" /> {t('downloadTemplate')}</button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ''; }}
            />
            <button onClick={() => fileRef.current?.click()} className="btn-primary"><Upload className="h-4 w-4" /> {t('chooseFile')}</button>
          </div>

          {formError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{formError}</div>}

          {importDone && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {t('importedRows')}: {importOk} · {t('importErrors')}: {importBad}
              </p>
              {importBad > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  {importRows.filter(r => r.error).map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-0 dark:border-slate-800">
                      <span className="truncate">{r.full_name || r.email}</span>
                      <span className="flex-shrink-0 text-red-600 dark:text-red-400">
                        {r.error === 'email_exists' ? t('emailExists') : r.error === 'invalid_role' ? t('roleInvalid') : t('loginError')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setImportOpen(false)} className="btn-ghost">{t('importClose')}</button>
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
