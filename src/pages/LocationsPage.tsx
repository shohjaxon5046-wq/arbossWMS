import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Printer, QrCode, ScanLine, Search, CheckSquare, Square, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { canManageInbound, inboundErrorKey, parseScannedShelf, SHELF_QR_PREFIX } from '@/lib/inbound';
import { LoadingSpinner, ErrorState, EmptyState, PageHeader } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Modal';
import { PrintLabelsModal } from '@/components/ui/PrintLabelsModal';
import { QrScanner } from '@/components/inbound/QrScanner';
import { InlineNotice, type Notice } from '@/components/inbound/InlineNotice';
import { CreateShelvesModal } from '@/components/locations/CreateShelvesModal';
import { ShelfDetailModal } from '@/components/locations/ShelfDetailModal';
import type { Label } from '@/lib/labels';
import type { ProductItem, ProductModel, WarehouseLocation } from '@/types';

type Data = { locations: WarehouseLocation[]; items: ProductItem[]; models: ProductModel[] };

export function LocationsPage() {
  const { t } = useApp();
  const { staff } = useAuth();
  const canManage = canManageInbound(staff?.role);
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [printTargets, setPrintTargets] = useState<Label[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WarehouseLocation | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState('');
  const [notice, setNotice] = useState<Notice>(null);

  const reload = useCallback(async () => {
    const [loc, itm, mod] = await Promise.all([
      supabase.from('erp_warehouse_locations').select('*').order('code'),
      supabase.from('erp_product_items').select('*').not('warehouse_location_id', 'is', null),
      supabase.from('erp_product_models').select('*'),
    ]);
    const failed = [loc, itm, mod].find(r => r.error);
    if (failed?.error) { setLoadError(failed.error.message); return; }
    setData({ locations: loc.data ?? [], items: itm.data ?? [], models: mod.data ?? [] });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const occupancy = useMemo(() => {
    const map = new Map<string, number>();
    data?.items.forEach(i => { if (i.warehouse_location_id) map.set(i.warehouse_location_id, (map.get(i.warehouse_location_id) ?? 0) + 1); });
    return map;
  }, [data]);

  if (loadError) return <ErrorState message={loadError} />;
  if (!data) return <LoadingSpinner text={t('loading')} />;

  const q = search.trim().toUpperCase();
  const visible = data.locations.filter(l => !q || l.code.includes(q) || (l.description ?? '').toUpperCase().includes(q));
  const sectors = [...new Set(visible.map(l => l.sector))];
  const allSelected = visible.length > 0 && visible.every(l => selected.has(l.id));
  const detail = data.locations.find(l => l.id === detailId) ?? null;

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visible.map(l => l.id)));

  const shelfLabels = (list: WarehouseLocation[]) =>
    list.map(l => ({ qrValue: SHELF_QR_PREFIX + l.code, title: l.code, subtitle: l.description || undefined }));

  const doDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('erp_warehouse_locations').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    if (error) { setNotice({ kind: 'error', text: t(inboundErrorKey(error)) }); return; }
    setDetailId(null);
    await reload();
  };

  const handleScan = (raw: string) => {
    const code = parseScannedShelf(raw);
    const match = data.locations.find(l => l.code === code);
    if (!match) { setScanError(`${t('shelfNotFound')}: ${code}`); return; }
    setScanOpen(false);
    setDetailId(match.id);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t('locations')}
        subtitle={t('locationsSubtitle')}
        action={canManage ? <button onClick={() => setCreateOpen(true)} className="btn-primary"><Plus className="h-4 w-4" /> {t('createShelves')}</button> : undefined}
      />

      {!canManage && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <Lock className="h-4 w-4" /> {t('readOnlyInbound')}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`${t('shelfCode')}, ${t('description').toLowerCase()}`} className="input-field pl-9" />
        </div>
        <button onClick={() => { setScanError(''); setScanOpen(true); }} className="btn-secondary"><ScanLine className="h-4 w-4" /> {t('scan')}</button>
        <button onClick={toggleAll} disabled={visible.length === 0} className="btn-secondary">
          {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />} {t('selectAll')}
        </button>
        <button
          onClick={() => setPrintTargets(shelfLabels(data.locations.filter(l => selected.has(l.id))))}
          disabled={selected.size === 0}
          className="btn-primary"
        >
          <Printer className="h-4 w-4" /> {t('printLabels')}{selected.size > 0 ? ` (${selected.size})` : ''}
        </button>
      </div>
      <InlineNotice notice={notice} onClose={() => setNotice(null)} />

      {visible.length === 0 ? (
        <div className="card"><EmptyState icon={<QrCode className="h-12 w-12 text-slate-300 dark:text-slate-600" />} title={t('noShelves')} /></div>
      ) : sectors.map(sector => (
        <section key={sector} className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900">{sector}</span>
            {t('sector')} {sector}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {visible.filter(l => l.sector === sector).map(l => {
              const used = occupancy.get(l.id) ?? 0;
              const pct = l.capacity > 0 ? Math.min(100, Math.round((used / l.capacity) * 100)) : 0;
              const isSel = selected.has(l.id);
              return (
                <div
                  key={l.id}
                  onClick={() => setDetailId(l.id)}
                  className={`card card-hover group relative cursor-pointer p-4 ${isSel ? 'ring-2 ring-blue-500' : ''} ${l.is_active ? '' : 'opacity-60'}`}
                >
                  <button
                    onClick={e => { e.stopPropagation(); toggle(l.id); }}
                    className={`absolute right-3 top-3 rounded p-0.5 transition-colors ${isSel ? 'text-blue-600' : 'text-slate-300 hover:text-slate-500 dark:text-slate-600'}`}
                    aria-label={t('selectAll')}
                  >
                    {isSel ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                  <QrCode className="h-5 w-5 text-slate-400 transition-colors group-hover:text-blue-500" />
                  <p className="mt-2 font-mono text-sm font-bold tracking-wide text-slate-900 dark:text-slate-100">{l.code}</p>
                  <p className="mt-0.5 h-4 truncate text-xs text-slate-500">{l.is_active ? l.description : t('inactive')}</p>
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>{t('occupancy')}</span>
                      <span>{used}{l.capacity > 0 ? `/${l.capacity}` : ''}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${l.capacity > 0 ? pct : used > 0 ? 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <CreateShelvesModal open={createOpen} onClose={() => setCreateOpen(false)} existing={data.locations} onCreated={reload} />

      <ShelfDetailModal
        location={detail}
        items={data.items}
        models={data.models}
        canManage={canManage}
        onClose={() => setDetailId(null)}
        onPrint={l => setPrintTargets(shelfLabels([l]))}
        onDelete={setDeleteTarget}
        onSaved={reload}
      />

<PrintLabelsModal labels={printTargets} onClose={() => setPrintTargets(null)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        title={t('delete')}
        message={deleteTarget ? `${deleteTarget.code}?` : ''}
      />

      <QrScanner open={scanOpen} onClose={() => setScanOpen(false)} onResult={handleScan} error={scanError} />
    </div>
  );
}
