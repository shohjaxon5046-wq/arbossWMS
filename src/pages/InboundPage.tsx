import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, PackageCheck, PackageOpen, Undo2, Boxes, Building, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { canManageInbound } from '@/lib/inbound';
import { LoadingSpinner, ErrorState, PageHeader } from '@/components/ui/States';
import { PurchaseOrdersTab } from '@/components/inbound/PurchaseOrdersTab';
import { ReceivingTab } from '@/components/inbound/ReceivingTab';
import { PutawayTab } from '@/components/inbound/PutawayTab';
import { ReturnsTab } from '@/components/inbound/ReturnsTab';
import { StockTab } from '@/components/inbound/StockTab';
import { SuppliersTab } from '@/components/inbound/SuppliersTab';
import type { TranslationKey } from '@/lib/i18n';
import type { InboundData } from '@/types';

export type InboundTab = 'orders' | 'receiving' | 'putaway' | 'returns' | 'stock' | 'suppliers';

const tabs: { id: InboundTab; label: TranslationKey; icon: typeof Boxes }[] = [
  { id: 'orders', label: 'tabPurchaseOrders', icon: ClipboardList },
  { id: 'receiving', label: 'tabReceiving', icon: PackageCheck },
  { id: 'putaway', label: 'tabPutaway', icon: PackageOpen },
  { id: 'returns', label: 'tabReturns', icon: Undo2 },
  { id: 'stock', label: 'tabStock', icon: Boxes },
  { id: 'suppliers', label: 'tabSuppliers', icon: Building },
];

interface InboundPageProps {
  initialSearch?: string;
  initialTab?: string;
}

export function InboundPage({ initialSearch, initialTab }: InboundPageProps) {
  const { t } = useApp();
  const { staff } = useAuth();
  const canManage = canManageInbound(staff?.role);
  const [tab, setTab] = useState<InboundTab>(tabs.some(x => x.id === initialTab) ? initialTab as InboundTab : 'orders');
  const [data, setData] = useState<InboundData | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    const [sup, mod, loc, itm, ord, ret] = await Promise.all([
      supabase.from('erp_suppliers').select('*').order('name'),
      supabase.from('erp_product_models').select('*').order('name'),
      supabase.from('erp_warehouse_locations').select('*').order('code'),
      supabase.from('erp_product_items').select('*').order('created_at', { ascending: false }),
      supabase.from('erp_purchase_orders').select('*, erp_purchase_order_lines(*)').order('created_at', { ascending: false }),
      supabase.from('erp_supplier_returns').select('*, erp_supplier_return_items(product_item_id)').order('created_at', { ascending: false }),
    ]);
    const failed = [sup, mod, loc, itm, ord, ret].find(r => r.error);
    if (failed?.error) {
      setError(failed.error.message);
      return;
    }
    setData({
      suppliers: sup.data ?? [],
      models: mod.data ?? [],
      locations: loc.data ?? [],
      items: itm.data ?? [],
      orders: ord.data ?? [],
      returns: ret.data ?? [],
    });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingSpinner text={t('loading')} />;

  const counts: Partial<Record<InboundTab, number>> = {
    receiving: data.orders.filter(o => o.status === 'yangi' || o.status === 'yuborildi' || o.status === 'qisman_qabul').length,
    putaway: data.items.filter(i => i.status === 'joylashtirish_kutilmoqda').length,
    returns: data.items.filter(i => i.status === 'qaytarish_kutilmoqda').length,
  };

  const props = { data, canManage, reload };

  return (
    <div className="space-y-6">
      <PageHeader title={t('inbound')} subtitle={t('inboundSubtitle')} />

      {!canManage && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
          <Lock className="h-4 w-4 flex-shrink-0" /> {t('readOnlyInbound')}
        </div>
      )}

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex min-w-full gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900 sm:min-w-0">
          {tabs.map((x, idx) => {
            const Icon = x.icon;
            const active = tab === x.id;
            const count = counts[x.id];
            return (
              <button
                key={x.id}
                onClick={() => setTab(x.id)}
                className={`flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${active
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
              >
                {idx < 4 && <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{idx + 1}</span>}
                {idx >= 4 && <Icon className="h-4 w-4" />}
                <span className="whitespace-nowrap">{t(x.label)}</span>
                {!!count && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div key={tab} className="animate-fade-in">
        {tab === 'orders' && <PurchaseOrdersTab {...props} onGoToReceiving={() => setTab('receiving')} />}
        {tab === 'receiving' && <ReceivingTab {...props} onGoToPutaway={() => setTab('putaway')} />}
        {tab === 'putaway' && <PutawayTab {...props} />}
        {tab === 'returns' && <ReturnsTab {...props} />}
        {tab === 'stock' && <StockTab {...props} initialSearch={initialTab === 'stock' ? initialSearch : undefined} />}
        {tab === 'suppliers' && <SuppliersTab {...props} />}
      </div>
    </div>
  );
}
