import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Coins, Layers, Loader2, Package, QrCode, Save, Wrench } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { ordersErrorKey } from '@/lib/orders';
import type { Label } from '@/lib/labels';
import type { TranslationKey } from '@/lib/i18n';
import { Modal } from '@/components/ui/Modal';
import { InlineNotice, type Notice } from '@/components/inbound/InlineNotice';
import { modelLabel, toForm, toPayload } from '@/components/catalog/modelForm';
import { GeneralTab } from '@/components/catalog/GeneralTab';
import { PricingTab } from '@/components/catalog/PricingTab';
import { KitTab } from '@/components/catalog/KitTab';
import { UnitsTab } from '@/components/catalog/UnitsTab';
import { MaintenanceTab } from '@/components/catalog/MaintenanceTab';
import type { Category, ProductItem, ProductModel } from '@/types';

type Tab = 'general' | 'pricing' | 'kit' | 'units' | 'maintenance';

const TABS: { id: Tab; labelKey: TranslationKey; icon: typeof Package; needsSaved?: boolean }[] = [
  { id: 'general', labelKey: 'catTabGeneral', icon: Package },
  { id: 'pricing', labelKey: 'catTabPricing', icon: Coins },
  { id: 'kit', labelKey: 'catTabKit', icon: Layers },
  { id: 'units', labelKey: 'catTabUnits', icon: ClipboardList, needsSaved: true },
  { id: 'maintenance', labelKey: 'catTabMaintenance', icon: Wrench, needsSaved: true },
];

interface Props {
  open: boolean;
  model: ProductModel | null;
  categories: Category[];
  canEdit: boolean;
  canEditPrices: boolean;
  onClose: () => void;
  onSaved: () => void;
  onCategoryAdded: (c: Category) => void;
  onPrint: (labels: Label[]) => void;
}

export function ModelModal({ open, model, categories, canEdit, canEditPrices, onClose, onSaved, onCategoryAdded, onPrint }: Props) {
  const { t } = useApp();
  const [saved, setSaved] = useState<ProductModel | null>(model);
  const [form, setForm] = useState(() => toForm(model));
  const [tab, setTab] = useState<Tab>('general');
  const [items, setItems] = useState<ProductItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (!open) return;
    setSaved(model);
    setForm(toForm(model));
    setTab('general');
    setNotice(null);
  }, [open, model]);

  const savedId = saved?.id;
  useEffect(() => {
    if (!open || !savedId) { setItems([]); return; }
    let cancelled = false;
    supabase.from('erp_product_items').select('*').eq('model_id', savedId).order('serial_number').then(({ data, error }) => {
      if (cancelled) return;
      if (error) setNotice({ kind: 'error', text: t(ordersErrorKey(error)) });
      else setItems((data ?? []) as ProductItem[]);
    });
    return () => { cancelled = true; };
  }, [open, savedId, t]);

  const showError = useCallback((text: string) => setNotice({ kind: 'error', text }), []);

  const handleSave = async () => {
    if (!form.name.trim()) { setTab('general'); showError(`${t('name')} *`); return; }
    setSaving(true);
    setNotice(null);
    const payload = toPayload(form, canEditPrices);
    const query = saved
      ? supabase.from('erp_product_models').update(payload).eq('id', saved.id).select().maybeSingle()
      : supabase.from('erp_product_models').insert(payload).select().maybeSingle();
    const { data, error } = await query;
    setSaving(false);
    if (error || !data) { showError(t(ordersErrorKey(error))); return; }
    const next = data as ProductModel;
    setSaved(next);
    setForm(toForm(next));
    setNotice({ kind: 'success', text: t('catSaved') });
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title={saved ? `${t('catEditModel')} · ${saved.name}` : t('catNewModel')} size="xl">
      <div className="-mx-6 -mt-6 mb-6 overflow-x-auto border-b border-slate-200 px-6 dark:border-slate-800">
        <div className="flex min-w-max gap-1">
          {TABS.map(({ id, labelKey, icon: Icon, needsSaved }) => {
            const active = tab === id;
            return (
              <button
                key={id} type="button" onClick={() => setTab(id)}
                className={`relative flex items-center gap-2 px-3 py-3 text-sm font-medium transition-colors ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'} ${needsSaved && !saved ? 'opacity-50' : ''}`}
              >
                <Icon className="h-4 w-4" />
                {t(labelKey)}
                {id === 'units' && items.length > 0 && <span className="rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">{items.length}</span>}
                <span className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-blue-600 transition-transform dark:bg-blue-400 ${active ? 'scale-x-100' : 'scale-x-0'}`} />
              </button>
            );
          })}
        </div>
      </div>

      {notice && <div className="mb-4"><InlineNotice notice={notice} onClose={() => setNotice(null)} /></div>}

      <div className="min-h-[340px]">
        {tab === 'general' && <GeneralTab form={form} setForm={setForm} categories={categories} onCategoryAdded={onCategoryAdded} onError={showError} />}
        {tab === 'pricing' && <PricingTab form={form} setForm={setForm} editable={canEditPrices} />}
        {tab === 'kit' && <KitTab form={form} setForm={setForm} />}
        {(tab === 'units' || tab === 'maintenance') && !saved && (
          <p className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500 dark:border-slate-700">{t('catSaveFirst')}</p>
        )}
        {tab === 'units' && saved && (
          <UnitsTab
            model={saved} items={items} canEditPct={canEditPrices} onPrint={onPrint} onError={showError}
            onItemChanged={it => setItems(list => list.map(x => (x.id === it.id ? it : x)))}
          />
        )}
        {tab === 'maintenance' && saved && <MaintenanceTab items={items} canEdit={canEdit} onError={showError} />}
      </div>

      <div className="-mx-6 -mb-6 mt-6 flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/60">
        <button type="button" onClick={() => saved && onPrint([modelLabel(saved)])} disabled={!saved} className="btn-secondary">
          <QrCode className="h-4 w-4" /> {t('catSticker')}
        </button>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-ghost">{t('cancel')}</button>
          {canEdit && (
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('save')}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
