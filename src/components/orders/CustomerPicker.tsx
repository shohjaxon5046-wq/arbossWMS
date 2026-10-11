import { useEffect, useState } from 'react';
import { CloudDownload, Loader2, Phone, Search, UserPlus, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency } from '@/lib/format';
import { CustomerFormModal } from '@/components/orders/CustomerFormModal';
import type { Customer } from '@/types';

interface Props {
  selected: Customer | null;
  onSelect: (c: Customer | null) => void;
}

export function CustomerPicker({ selected, onSelect }: Props) {
  const { t } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    const q = query.replace(/[,()%*\\]/g, ' ').trim();
    if (q.length < 2) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.from('erp_customers').select('*')
          .or(`full_name.ilike.%${q}%,phone_primary.ilike.%${q}%,phone_secondary.ilike.%${q}%,passport_number.ilike.%${q}%`)
          .order('full_name').limit(8);
        if (!cancelled) {
          if (error) {
            console.warn('Customer search error:', error);
          }
          setResults((data || []) as Customer[]);
          setSearching(false);
        }
      } catch (err) {
        console.warn('Customer search exception:', err);
        if (!cancelled) {
          setResults([]);
          setSearching(false);
        }
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900/50 dark:bg-blue-900/10">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
          {selected.full_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{selected.full_name}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {selected.phone_primary}
            {selected.passport_number && ` · ${selected.passport_series} ${selected.passport_number}`}
          </p>
        </div>
        {Number(selected.debt) > 0 && (
          <span className="badge bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">{t('debt')}: {formatCurrency(selected.debt)}</span>
        )}
        <button onClick={() => onSelect(null)} className="btn-ghost !px-3 !py-1.5 text-xs">{t('ordChangeCustomer')}</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={t('ordSearchCustomer')} className="input-field pl-9" />
          {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
        </div>
        <button onClick={() => setFormOpen(true)} className="btn-primary whitespace-nowrap">
          <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">{t('ordNewCustomer')}</span>
        </button>
        <button disabled title={t('ordIboxSoon')} className="btn-secondary cursor-not-allowed whitespace-nowrap opacity-50">
          <CloudDownload className="h-4 w-4" /> <span className="hidden md:inline">{t('ordIboxSearch')}</span>
        </button>
      </div>

      {query.trim().length >= 2 && !searching && (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
          {results.length === 0 ? (
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
              <span>{t('ordNoCustomerFound')}</span>
              <button onClick={() => setFormOpen(true)} className="font-medium text-blue-600 hover:underline dark:text-blue-400">+ {t('ordNewCustomer')}</button>
            </div>
          ) : results.map(c => (
            <button key={c.id} onClick={() => { onSelect(c); setQuery(''); }}
              className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60">
              <UserRound className="h-4 w-4 flex-shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{c.full_name}</p>
                <p className="flex items-center gap-1 truncate text-xs text-slate-400"><Phone className="h-3 w-3" /> {c.phone_primary}
                  {c.passport_number && ` · ${c.passport_series} ${c.passport_number}`}</p>
              </div>
              {Number(c.debt) > 0 && <span className="text-xs font-medium text-red-600 dark:text-red-400">{formatCurrency(c.debt)}</span>}
            </button>
          ))}
        </div>
      )}

      <CustomerFormModal open={formOpen} initialQuery={query} onClose={() => setFormOpen(false)}
        onCreated={c => { setFormOpen(false); setQuery(''); onSelect(c); }} />
    </div>
  );
}
