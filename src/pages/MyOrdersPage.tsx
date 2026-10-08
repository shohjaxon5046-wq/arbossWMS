import { useCallback, useEffect, useState } from 'react';
import { Inbox, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/format';
import { LoadingSpinner, ErrorState, EmptyState, PageHeader } from '@/components/ui/States';
import type { TranslationKey } from '@/lib/i18n';
import type { LogisticsOrder, LogisticsService } from '@/types/logistics';

const serviceLabelKey: Record<LogisticsService, TranslationKey> = {
  gruzchik: 'serviceGruzchik',
  kran: 'serviceKran',
  musir: 'serviceMusir',
};

export function MyOrdersPage() {
  const { t } = useApp();
  const [orders, setOrders] = useState<LogisticsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('logistics_orders')
      .select('*').order('created_at', { ascending: false }).limit(500);
    if (err) setError(err.message);
    else setOrders((data ?? []) as LogisticsOrder[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner text={t('loading')} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t('myOrders')} subtitle={t('newOrderSubtitle')} />
      {orders.length === 0 ? (
        <EmptyState icon={<Inbox className="h-12 w-12 text-slate-300 dark:text-slate-600" />} title={t('noOrders')} />
      ) : (
        <div className="space-y-3">
          {orders.map(o => (
            <div key={o.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">{o.order_number}</p>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t(serviceLabelKey[o.service])}</p>
                </div>
                <span className={`badge ${getStatusColor(o.status)}`}>{t(`status_${o.status}` as TranslationKey)}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-slate-400">{t('customer')}</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{o.customer_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">{t('estimatedSum')}</p>
                  <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(o.estimated_price)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">{t('loAddress')}</p>
                  <p className="text-slate-800 dark:text-slate-200">{o.address || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">{t('createdAt')}</p>
                  <p className="text-slate-800 dark:text-slate-200">{formatDate(o.created_at)}</p>
                </div>
              </div>
              {o.customer_phone && (
                <a href={`tel:${o.customer_phone}`} className="btn-ghost mt-3 justify-center text-sm">
                  <Phone className="h-4 w-4" /> {t('callCustomer')}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
