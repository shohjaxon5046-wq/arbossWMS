import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Plus, Pencil, Trash2, Package, Search, QrCode, Printer, FileSpreadsheet, Upload, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/format';
import { canEditCatalog, canEditPrices, modelImageUrl, ordersErrorKey } from '@/lib/orders';
import type { Label } from '@/lib/labels';
import { LoadingSpinner, ErrorState, EmptyState, PageHeader } from '@/components/ui/States';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { PrintLabelsModal } from '@/components/ui/PrintLabelsModal';
import { InlineNotice, type Notice } from '@/components/inbound/InlineNotice';
import { ModelModal } from '@/components/catalog/ModelModal';
import { modelLabel } from '@/components/catalog/modelForm';
import { readFirstSheet, normalizeKeys, downloadProductsTemplate } from '@/lib/excel';
import type { Category, ProductItemStatus, ProductModel } from '@/types';

interface ModelWithCounts extends ProductModel {
  total_units: number;
  available_units: number;
}

export function CatalogPage({ initialSearch }: { initialSearch?: string }) {
  const { t } = useApp();
  const { staff } = useAuth();
  const canEdit = canEditCatalog(staff?.role);
  const canPrice = canEditPrices(staff?.role);
  const [models, setModels] = useState<ModelWithCounts[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [search, setSearch] = useState(initialSearch ?? '');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductModel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductModel | null>(null);
  const [printTargets, setPrintTargets] = useState<Label[] | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    const [modelsRes, itemsRes, catRes] = await Promise.all([
      supabase.from('erp_product_models').select('*').order('created_at', { ascending: false }),
      supabase.from('erp_product_items').select('model_id, status'),
      supabase.from('erp_categories').select('*').order('name'),
    ]);
    const err = modelsRes.error || itemsRes.error || catRes.error;
    if (err) { setError(err.message); setLoading(false); return; }
    const counts = new Map<string, { total: number; free: number }>();
    for (const i of (itemsRes.data ?? []) as { model_id: string; status: ProductItemStatus }[]) {
      const c = counts.get(i.model_id) ?? { total: 0, free: 0 };
      c.total += 1;
      if (i.status === 'omborda_bosh') c.free += 1;
      counts.set(i.model_id, c);
    }
    setModels(((modelsRes.data ?? []) as ProductModel[]).map(m => ({
      ...m, total_units: counts.get(m.id)?.total ?? 0, available_units: counts.get(m.id)?.free ?? 0,
    })));
    setCategories((catRes.data ?? []) as Category[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (m: ProductModel) => { setEditing(m); setModalOpen(true); };

  const handleImportProducts = async (file: File) => {
    setImporting(true);
    setImportMsg('');
    try {
      const raw = await readFirstSheet(file);
      const rows = normalizeKeys(raw)
        .filter((r) => (r.full_name ?? '').trim() !== '')
        .map((r) => ({
          name: (r.full_name ?? '').trim(),
          brand: (r.brand ?? '').trim(),
          category: (r.category ?? '').trim(),
          model_code: (r.model_code ?? '').trim(),
          daily_price: Math.max(0, Math.round(Number(r.daily_price) || 0)),
          deposit_amount: Math.max(0, Math.round(Number(r.deposit) || 0)),
        }));
      let okCount = 0;
      for (const row of rows) {
        const { error: insErr } = await supabase.from('erp_product_models').insert(row);
        if (!insErr) okCount += 1;
      }
      setImportMsg(`${t('productImported')}: ${okCount}${rows.length !== okCount ? ` (${t('skippedRows')}: ${rows.length - okCount})` : ''}`);
      loadData();
    } catch {
      setImportMsg(t('errGeneric'));
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error: delError } = await supabase.from('erp_product_models').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    if (delError) { setNotice({ kind: 'error', text: t(ordersErrorKey(delError)) }); return; }
    loadData();
  };

  const usedCategories = useMemo(() => Array.from(new Set(models.map(m => m.category).filter(Boolean))).sort(), [models]);

  const filtered = models.filter(m => {
    if (categoryFilter && m.category !== categoryFilter) return false;
    const q = search.toLowerCase();
    return [m.name, m.brand, m.category, m.model_code].some(v => (v ?? '').toLowerCase().includes(q));
  });

  if (loading) return <LoadingSpinner text={t('loading')} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('equipmentCatalog')}
        action={
          <div className="flex gap-2">
            {canPrice && (
              <button onClick={() => { setImportOpen(true); setImportMsg(''); }} className="btn-secondary"><FileSpreadsheet className="h-4 w-4" /> <span className="hidden sm:inline">{t('importProducts')}</span></button>
            )}
            {filtered.length > 0 && (
              <button onClick={() => setPrintTargets(filtered.map(modelLabel))} className="btn-secondary"><Printer className="h-4 w-4" /> <span className="hidden sm:inline">{t('catPrintModelQr')}</span></button>
            )}
            {canEdit && <button onClick={openAdd} className="btn-primary"><Plus className="h-4 w-4" /> {t('catNewModel')}</button>}
          </div>
        }
      />

      {notice && <InlineNotice notice={notice} onClose={() => setNotice(null)} />}

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} className="input-field pl-9" />
        </div>
        {usedCategories.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {['', ...usedCategories].map(c => (
              <button key={c || 'all'} onClick={() => setCategoryFilter(c)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${categoryFilter === c ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>
                {c || t('all')}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="h-12 w-12 text-slate-300 dark:text-slate-600" />}
          title={t('noData')}
          action={canEdit ? <button onClick={openAdd} className="btn-primary"><Plus className="h-4 w-4" /> {t('catNewModel')}</button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(m => {
            const img = modelImageUrl(m.image_url);
            return (
              <div key={m.id} className="card group overflow-hidden transition-shadow hover:shadow-lg">
                <button onClick={() => (canEdit || canPrice) && openEdit(m)} className="relative block aspect-[4/3] w-full overflow-hidden bg-slate-50 dark:bg-slate-800/50" disabled={!canEdit && !canPrice}>
                  {img ? (
                    <img src={img} alt={m.name} loading="lazy" className="h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                      <Package className="h-12 w-12" />
                      <span className="mt-1 text-xs">{t('catNoPhoto')}</span>
                    </div>
                  )}
                  <span className={`badge absolute left-3 top-3 ${m.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                    {m.is_active ? t('active') : t('inactive')}
                  </span>
                  {m.category && <span className="badge absolute right-3 top-3 bg-white/90 text-slate-700 shadow-sm dark:bg-slate-900/90 dark:text-slate-200">{m.category}</span>}
                </button>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">{m.name}</h3>
                      <p className="truncate text-xs text-slate-400">{[m.brand, m.model_code].filter(Boolean).join(' · ') || '—'}</p>
                    </div>
                    <div className="flex flex-shrink-0 gap-0.5">
                      <button onClick={() => setPrintTargets([modelLabel(m)])} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800" aria-label={t('catSticker')} title={t('catSticker')}><QrCode className="h-4 w-4" /></button>
                      {canEdit && <button onClick={() => openEdit(m)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800" aria-label={t('edit')}><Pencil className="h-4 w-4" /></button>}
                      {canEdit && <button onClick={() => setDeleteTarget(m)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" aria-label={t('delete')}><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                    <div>
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatCurrency(m.daily_price)}</p>
                      <p className="text-xs text-slate-400">{t('deposit')}: {formatCurrency(m.deposit_amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold"><span className="text-emerald-600 dark:text-emerald-400">{m.available_units}</span><span className="text-slate-400"> / {m.total_units}</span></p>
                      <p className="text-xs text-slate-400">{t('catFree')} / {t('catUnits')}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ModelModal
        open={modalOpen}
        model={editing}
        categories={categories}
        canEdit={canEdit}
        canEditPrices={canPrice}
        onClose={() => setModalOpen(false)}
        onSaved={loadData}
        onCategoryAdded={c => setCategories(list => [...list, c].sort((a, b) => a.name.localeCompare(b.name)))}
        onPrint={setPrintTargets}
      />

      <PrintLabelsModal labels={printTargets} onClose={() => setPrintTargets(null)} />

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title={t('importProducts')} size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('importProductsHint')}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={downloadProductsTemplate} className="btn-secondary"><Download className="h-4 w-4" /> {t('downloadTemplate')}</button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImportProducts(f); e.target.value = ''; }}
            />
            <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn-primary">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {t('chooseFile')}
            </button>
          </div>
          {importMsg && <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800/50 dark:text-slate-200">{importMsg}</p>}
          <div className="flex justify-end">
            <button onClick={() => setImportOpen(false)} className="btn-ghost">{t('close')}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('delete')}
        message={`${deleteTarget?.name || ''}?`}
      />
    </div>
  );
}
