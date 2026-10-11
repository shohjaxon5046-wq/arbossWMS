import { useEffect, useRef, useState } from 'react';
import { Search, Loader2, ShoppingCart, UserCircle, Package, Boxes, Truck, Wrench, X, CornerDownLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import type { TranslationKey } from '@/lib/i18n';
import type { PageId } from '@/components/Layout';

export interface SearchTarget {
  page: PageId;
  query: string;
  tab?: string;
}

interface Result extends SearchTarget {
  id: string;
  group: TranslationKey;
  title: string;
  subtitle: string;
  status?: string;
}

const groupIcons: Partial<Record<TranslationKey, typeof Search>> = {
  searchOrders: ShoppingCart,
  searchCustomers: UserCircle,
  searchEquipment: Boxes,
  searchModels: Package,
  searchPartners: Truck,
  searchServiceOrders: Wrench,
};

const sanitize = (s: string) => s.replace(/[%_,()*\\]/g, ' ').trim();

async function runSearch(raw: string, allowed: PageId[]): Promise<Result[]> {
  const q = sanitize(raw);
  const like = `%${q}%`;
  const tasks: Promise<Result[]>[] = [];

  if (allowed.includes('orders')) {
    tasks.push((async () => {
      const { data, error } = await supabase.from('erp_orders')
        .select('id, order_number, customer_name, customer_phone, status')
        .or(`order_number.ilike.${like},customer_name.ilike.${like},customer_phone.ilike.${like}`)
        .order('created_at', { ascending: false }).limit(5);
      if (error) throw error;
      return (data ?? []).map((o: any) => ({
        id: `o-${o.id}`, group: 'searchOrders' as const, page: 'orders' as const, query: o.order_number,
        title: o.order_number, subtitle: `${o.customer_name} ${o.customer_phone ?? ''}`.trim(), status: o.status,
      }));
    })());
  }

  if (allowed.includes('crm')) {
    tasks.push((async () => {
      const { data, error } = await supabase.from('erp_customers')
        .select('id, full_name, phone_primary, phone_secondary')
        .or(`full_name.ilike.${like},phone_primary.ilike.${like},phone_secondary.ilike.${like},passport_number.ilike.${like}`)
        .limit(5);
      if (error) throw error;
      return (data ?? []).map((c: any) => ({
        id: `c-${c.id}`, group: 'searchCustomers' as const, page: 'crm' as const, query: c.full_name,
        title: c.full_name, subtitle: c.phone_primary ?? '',
      }));
    })());
  }

  if (allowed.includes('inbound')) {
    tasks.push((async () => {
      const { data, error } = await supabase.from('erp_product_items')
        .select('id, serial_number, barcode, status, erp_product_models(name)')
        .or(`serial_number.ilike.${like},barcode.ilike.${like}`)
        .limit(5);
      if (error) throw error;
      return (data ?? []).map((i: any) => {
        const model = i.erp_product_models as unknown as { name: string } | null;
        return {
          id: `i-${i.id}`, group: 'searchEquipment' as const, page: 'inbound' as const, tab: 'stock', query: i.serial_number,
          title: i.serial_number, subtitle: [model?.name, i.barcode].filter(Boolean).join(' · '), status: i.status,
        };
      });
    })());
  }

  if (allowed.includes('catalog')) {
    tasks.push((async () => {
      const { data, error } = await supabase.from('erp_product_models')
        .select('id, name, brand, category')
        .or(`name.ilike.${like},brand.ilike.${like},category.ilike.${like}`)
        .limit(5);
      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        id: `m-${m.id}`, group: 'searchModels' as const, page: 'catalog' as const, query: m.name,
        title: m.name, subtitle: [m.brand, m.category].filter(Boolean).join(' · '),
      }));
    })());
  }

  if (allowed.includes('partners')) {
    tasks.push((async () => {
      const { data, error } = await supabase.from('erp_service_partners')
        .select('id, company_name, service_category, phone_primary, status')
        .or(`company_name.ilike.${like},phone_primary.ilike.${like}`)
        .limit(5);
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        id: `p-${p.id}`, group: 'searchPartners' as const, page: 'partners' as const, tab: 'partners', query: p.company_name,
        title: p.company_name, subtitle: `${p.service_category} · ${p.phone_primary ?? ''}`, status: p.status,
      }));
    })());
    tasks.push((async () => {
      const { data, error } = await supabase.from('erp_service_orders')
        .select('id, order_number, customer_name, service_category, order_status, erp_orders(order_number)')
        .or(`order_number.ilike.${like},customer_name.ilike.${like},customer_phone.ilike.${like}`)
        .order('created_at', { ascending: false }).limit(5);
      if (error) throw error;
      return (data ?? []).map((s: any) => {
        const parent = s.erp_orders as unknown as { order_number: string } | null;
        return {
        id: `s-${s.id}`, group: 'searchServiceOrders' as const, page: 'orders' as const, query: parent?.order_number ?? s.customer_name,
        title: s.order_number, subtitle: `${s.customer_name} · ${s.service_category}`, status: s.order_status,
        };
      });
    })());
  }

  return (await Promise.all(tasks)).flat();
}

interface GlobalSearchProps {
  allowedPages: PageId[];
  onSelect: (target: SearchTarget) => void;
}

export function GlobalSearch({ allowedPages, onSelect }: GlobalSearchProps) {
  const { t } = useApp();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const allowedKey = allowedPages.join(',');

  useEffect(() => {
    const q = sanitize(query);
    if (q.length < 2) { setResults([]); setLoading(false); setError(false); return; }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const r = await runSearch(q, allowedKey.split(',') as PageId[]);
        if (!cancelled) { setResults(r); setError(false); setActive(0); }
      } catch {
        if (!cancelled) { setResults([]); setError(true); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, allowedKey]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  const choose = (r: Result) => {
    onSelect({ page: r.page, query: r.query, tab: r.tab });
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); return; }
    if (!results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % results.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + results.length) % results.length); }
    if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
  };

  const groups = results.reduce<Record<string, Result[]>>((acc, r) => {
    (acc[r.group] ??= []).push(r);
    return acc;
  }, {});
  const showPanel = open && query.trim().length > 0;

  return (
    <div ref={wrapRef} className="relative w-full sm:w-80">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={t('globalSearchPlaceholder')}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-16 text-sm text-slate-700 placeholder-slate-400 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:bg-slate-900"
      />
      {query ? (
        <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700">
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-900 md:block">Ctrl K</kbd>
      )}

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 sm:w-[28rem]">
          {sanitize(query).length < 2 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">{t('searchMinChars')}</p>
          ) : loading && !results.length ? (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('searching')}
            </div>
          ) : error ? (
            <p className="px-4 py-6 text-center text-sm text-red-500">{t('searchError')}</p>
          ) : !results.length ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">{t('noResults')}</p>
          ) : (
            <div className="py-2">
              {Object.entries(groups).map(([group, items]) => {
                const Icon = groupIcons[group as TranslationKey] ?? Search;
                return (
                  <div key={group} className="py-1">
                    <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t(group as TranslationKey)}</p>
                    {items.map(r => {
                      const idx = results.indexOf(r);
                      const isActive = idx === active;
                      return (
                        <button
                          key={r.id}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => choose(r)}
                          className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                        >
                          <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{r.title}</span>
                            {r.subtitle && <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{r.subtitle}</span>}
                          </span>
                          {r.status && (
                            <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {t(r.status as TranslationKey) || r.status}
                            </span>
                          )}
                          {isActive && <CornerDownLeft className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
