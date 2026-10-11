import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, Truck, Search, Loader2, Phone,
  CheckCircle2, XCircle, Wrench, Users, Shield, ArrowUpRight,
  Filter, Sparkles, AlertCircle, RefreshCw, Star
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { normalizePhone, formatCurrency } from '@/lib/format';
import { SERVICE_CATEGORIES } from '@/lib/orders';
import { LoadingSpinner, ErrorState, EmptyState, PageHeader } from '@/components/ui/States';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import type { ServicePartner, PartnerSpecs } from '@/types';

// Helper to get category details
export function getCategoryInfo(categoryKey: string, customName?: string) {
  const found = SERVICE_CATEGORIES.find(c => c.value === categoryKey);
  if (found) {
    return {
      title: found.titleUz,
      icon: found.icon,
      value: found.value,
    };
  }
  return {
    title: customName || categoryKey || 'Maxsus texnika',
    icon: '🚜',
    value: categoryKey,
  };
}

// Generate formatted one-liner string for each machine as requested
export function getMachineSummaryLine(p: ServicePartner): string {
  const specs = p.specs || {};
  const cat = p.service_category;
  const parts: string[] = [];

  if (cat === 'avtokran') {
    if (specs.lifting_capacity) parts.push(`Yuk ${specs.lifting_capacity}`);
    if (specs.boom_length) parts.push(`Strela ${specs.boom_length}`);
    if (specs.min_hours) parts.push(`Min ${specs.min_hours}`);
    if (specs.hourly_rate) parts.push(`${formatCurrency(Number(specs.hourly_rate))} /soat`);
  } else if (cat === 'manipulyator') {
    if (specs.body_capacity) parts.push(`Bort ${specs.body_capacity}`);
    if (specs.crane_capacity) parts.push(`Strela ${specs.crane_capacity}`);
    if (specs.body_length) parts.push(`Bort ${specs.body_length}`);
    if (specs.hourly_rate) parts.push(`${formatCurrency(Number(specs.hourly_rate))} /soat`);
  } else if (cat === 'avtolift') {
    if (specs.lift_height) parts.push(`Balandlik ${specs.lift_height}`);
    if (specs.basket_capacity) parts.push(`Lyulka ${specs.basket_capacity}`);
    if (specs.hourly_rate) parts.push(`${formatCurrency(Number(specs.hourly_rate))} /soat`);
    else if (specs.trip_price) parts.push(`${formatCurrency(Number(specs.trip_price))} /reys`);
  } else if (cat === 'musor') {
    if (specs.body_volume) parts.push(`Kuzov ${specs.body_volume}`);
    if (specs.tonnage) parts.push(`Yuk ${specs.tonnage}`);
    if (specs.trip_price) parts.push(`${formatCurrency(Number(specs.trip_price))} /reys`);
  } else if (cat === 'gruzchik') {
    if (specs.worker_count) parts.push(`${specs.worker_count}`);
    if (specs.rate_type === 'ogirlik' && specs.weight_rate) {
      parts.push(`Tarif: ${specs.weight_rate}`);
    } else if (specs.hourly_rate) {
      parts.push(`${formatCurrency(Number(specs.hourly_rate))} /soat`);
    }
  } else {
    // boshqa
    if (p.custom_category_name) parts.push(p.custom_category_name);
    if (specs.custom_specs) parts.push(specs.custom_specs);
    if (specs.hourly_rate) parts.push(`${formatCurrency(Number(specs.hourly_rate))} /soat`);
  }

  const statusText = p.is_available ? 'Bo‘sh' : 'Band';
  const detailStr = parts.length > 0 ? ` — ${parts.join(', ')}` : '';
  return `${p.company_name}${detailStr} — ${statusText}`;
}

export function PartnersPage({ initialSearch }: { initialSearch?: string }) {
  const { t } = useApp();
  const [partners, setPartners] = useState<ServicePartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(initialSearch ?? '');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'busy'>('all');
  const [partnerModal, setPartnerModal] = useState(false);
  const [editing, setEditing] = useState<ServicePartner | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletePartner, setDeletePartner] = useState<ServicePartner | null>(null);

  // Form State
  const emptyPartnerForm = {
    company_name: '',
    service_category: 'avtokran',
    custom_category_name: '',
    driver_name: '',
    license_plate: '',
    phone_primary: '',
    phone_secondary: '',
    notes: '',
    is_available: true,
    rating: 5,
    specs: {
      lifting_capacity: '25t',
      boom_length: '28m',
      hourly_rate: '400000',
      min_hours: '2 soat',
      body_capacity: '10t',
      crane_capacity: '3t',
      body_length: '6 metr',
      lift_height: '12-qavat / 35 metr',
      basket_capacity: '400 kg',
      body_volume: '16 m³',
      tonnage: '5t',
      trip_price: '450000',
      worker_count: '4 kishi',
      rate_type: 'soatlik',
      weight_rate: '150 so\'m/kg',
      custom_specs: '',
    } as PartnerSpecs,
  };

  const [partnerForm, setPartnerForm] = useState(emptyPartnerForm);

  const loadData = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from('erp_service_partners')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setPartners((data || []) as ServicePartner[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ma\'lumotlarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAddPartner = (defaultCategory?: string) => {
    setEditing(null);
    setPartnerForm({
      ...emptyPartnerForm,
      service_category: defaultCategory || 'avtokran',
      specs: { ...emptyPartnerForm.specs },
    });
    setPartnerModal(true);
  };

  const openEditPartner = (p: ServicePartner) => {
    setEditing(p);
    setPartnerForm({
      company_name: p.company_name || '',
      service_category: p.service_category || 'avtokran',
      custom_category_name: p.custom_category_name || '',
      driver_name: p.driver_name || '',
      license_plate: p.license_plate || '',
      phone_primary: p.phone_primary || '',
      phone_secondary: p.phone_secondary || '',
      notes: p.notes || '',
      is_available: p.is_available ?? true,
      rating: p.rating || 5,
      specs: {
        ...emptyPartnerForm.specs,
        ...(p.specs || {}),
      },
    });
    setPartnerModal(true);
  };

  const updateSpecField = (key: string, value: any) => {
    setPartnerForm(prev => ({
      ...prev,
      specs: {
        ...prev.specs,
        [key]: value,
      },
    }));
  };

  const handleSavePartner = async () => {
    if (!partnerForm.company_name.trim()) return;
    setSaving(true);
    try {
      // Clean up specs according to current category
      const currentCat = partnerForm.service_category;
      const filteredSpecs: PartnerSpecs = {};

      if (currentCat === 'avtokran') {
        filteredSpecs.lifting_capacity = partnerForm.specs.lifting_capacity;
        filteredSpecs.boom_length = partnerForm.specs.boom_length;
        filteredSpecs.hourly_rate = Number(partnerForm.specs.hourly_rate) || 0;
        filteredSpecs.min_hours = partnerForm.specs.min_hours;
      } else if (currentCat === 'manipulyator') {
        filteredSpecs.body_capacity = partnerForm.specs.body_capacity;
        filteredSpecs.crane_capacity = partnerForm.specs.crane_capacity;
        filteredSpecs.body_length = partnerForm.specs.body_length;
        filteredSpecs.hourly_rate = Number(partnerForm.specs.hourly_rate) || 0;
      } else if (currentCat === 'avtolift') {
        filteredSpecs.lift_height = partnerForm.specs.lift_height;
        filteredSpecs.basket_capacity = partnerForm.specs.basket_capacity;
        if (partnerForm.specs.hourly_rate) {
          filteredSpecs.hourly_rate = Number(partnerForm.specs.hourly_rate) || 0;
        }
        if (partnerForm.specs.trip_price) {
          filteredSpecs.trip_price = Number(partnerForm.specs.trip_price) || 0;
        }
      } else if (currentCat === 'musor') {
        filteredSpecs.body_volume = partnerForm.specs.body_volume;
        filteredSpecs.tonnage = partnerForm.specs.tonnage;
        filteredSpecs.trip_price = Number(partnerForm.specs.trip_price) || 0;
      } else if (currentCat === 'gruzchik') {
        filteredSpecs.worker_count = partnerForm.specs.worker_count;
        filteredSpecs.rate_type = partnerForm.specs.rate_type;
        if (partnerForm.specs.rate_type === 'ogirlik') {
          filteredSpecs.weight_rate = partnerForm.specs.weight_rate;
        } else {
          filteredSpecs.hourly_rate = Number(partnerForm.specs.hourly_rate) || 0;
        }
      } else {
        // boshqa
        filteredSpecs.custom_specs = partnerForm.specs.custom_specs;
        filteredSpecs.hourly_rate = Number(partnerForm.specs.hourly_rate) || 0;
      }

      const payload = {
        company_name: partnerForm.company_name.trim(),
        service_category: partnerForm.service_category,
        custom_category_name: partnerForm.service_category === 'boshqa' ? partnerForm.custom_category_name.trim() : null,
        driver_name: partnerForm.driver_name.trim(),
        license_plate: partnerForm.license_plate.trim().toUpperCase(),
        phone_primary: partnerForm.phone_primary.trim(),
        phone_secondary: partnerForm.phone_secondary.trim(),
        notes: partnerForm.notes.trim(),
        is_available: partnerForm.is_available,
        status: partnerForm.is_available ? 'bosh' : 'band',
        rating: Number(partnerForm.rating) || 5,
        specs: filteredSpecs,
      };

      if (editing) {
        const { error: updateError } = await supabase
          .from('erp_service_partners')
          .update(payload)
          .eq('id', editing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('erp_service_partners')
          .insert(payload);
        if (insertError) throw insertError;
      }

      setPartnerModal(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saqlashda xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailability = async (p: ServicePartner) => {
    try {
      setTogglingId(p.id);
      const nextAvailable = !p.is_available;
      const { error: err } = await supabase
        .from('erp_service_partners')
        .update({
          is_available: nextAvailable,
          status: nextAvailable ? 'bosh' : 'band',
        })
        .eq('id', p.id);

      if (err) throw err;

      setPartners(prev =>
        prev.map(item => (item.id === p.id ? { ...item, is_available: nextAvailable, status: nextAvailable ? 'bosh' : 'band' } : item))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Holatni yangilashda xatolik');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeletePartner = async () => {
    if (!deletePartner) return;
    try {
      const { error: delError } = await supabase
        .from('erp_service_partners')
        .delete()
        .eq('id', deletePartner.id);

      if (delError) throw delError;
      setDeletePartner(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'O\'chirishda xatolik');
    }
  };

  // Filtered partners
  const filteredPartners = useMemo(() => {
    return partners.filter(p => {
      // Category filter
      if (selectedCategoryFilter !== 'all' && p.service_category !== selectedCategoryFilter) {
        return false;
      }
      // Availability filter
      if (availabilityFilter === 'available' && !p.is_available) return false;
      if (availabilityFilter === 'busy' && p.is_available) return false;

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const specsText = JSON.stringify(p.specs || {}).toLowerCase();
        const matchesName = (p.company_name || '').toLowerCase().includes(q);
        const matchesDriver = (p.driver_name || '').toLowerCase().includes(q);
        const matchesPlate = (p.license_plate || '').toLowerCase().includes(q);
        const matchesPhone = (p.phone_primary || '').includes(q) || (p.phone_secondary || '').includes(q);
        const matchesCat = (p.service_category || '').toLowerCase().includes(q) || (p.custom_category_name || '').toLowerCase().includes(q);
        const matchesSpecs = specsText.includes(q);
        return matchesName || matchesDriver || matchesPlate || matchesPhone || matchesCat || matchesSpecs;
      }

      return true;
    });
  }, [partners, selectedCategoryFilter, availabilityFilter, search]);

  // Statistics counters
  const totalCount = partners.length;
  const availableCount = partners.filter(p => p.is_available).length;
  const busyCount = partners.filter(p => !p.is_available).length;

  if (loading) return <LoadingSpinner text={t('loading')} />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Hamkorlar va Maxsus Texnikalar"
        subtitle="Avtokranlar, manipulyatorlar, fasad liftlari, chiqindi mashinalari va ishchilar dispetcherligi"
        action={
          <button onClick={() => openAddPartner()} className="btn-primary flex items-center gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            <span>Yangi texnika / Hamkor qo‘shish</span>
          </button>
        }
      />

      {/* KPI Counters Banner */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Jami texnikalar</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{totalCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Bo‘sh (Tayyor)</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{availableCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
            <XCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Band (Ishda)</p>
            <p className="text-xl font-bold text-rose-600 dark:text-rose-400">{busyCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <Star className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">O‘rtacha reyting</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">4.9 ★</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Qidiruv: Mashina nomi, haydovchi, davlat raqami (01 777 AAA), telefon yoki parametrlar..."
              className="input-field pl-10"
            />
          </div>

          {/* Availability pills */}
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              onClick={() => setAvailabilityFilter('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                availabilityFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              Barchasi ({partners.length})
            </button>
            <button
              onClick={() => setAvailabilityFilter('available')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                availabilityFilter === 'available'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              Faqat bo‘sh ({availableCount})
            </button>
            <button
              onClick={() => setAvailabilityFilter('busy')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                availabilityFilter === 'busy'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
              }`}
            >
              Faqat band ({busyCount})
            </button>
          </div>
        </div>

        {/* Category Pills Slider */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <button
            onClick={() => setSelectedCategoryFilter('all')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              selectedCategoryFilter === 'all'
                ? 'bg-slate-900 text-white shadow-sm dark:bg-blue-600'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            <span>Barcha toifalar</span>
          </button>
          {SERVICE_CATEGORIES.map(cat => {
            const isSelected = selectedCategoryFilter === cat.value;
            const countInCat = partners.filter(p => p.service_category === cat.value).length;
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategoryFilter(cat.value)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.titleUz}</span>
                {countInCat > 0 && (
                  <span className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${
                    isSelected ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                    {countInCat}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards Grid */}
      {filteredPartners.length === 0 ? (
        <EmptyState
          icon={<Truck className="h-12 w-12 text-slate-300 dark:text-slate-600" />}
          title="Hech qanday maxsus texnika topilmadi"
          description={search ? "Qidiruv shartlarini o‘zgartirib ko‘ring" : "Yangi texnika yoki xizmat qo‘shing"}
          action={
            <button onClick={() => openAddPartner()} className="btn-primary">
              <Plus className="h-4 w-4" /> Yangi hamkor qo‘shish
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredPartners.map(p => {
            const catInfo = getCategoryInfo(p.service_category, p.custom_category_name);
            const specs = p.specs || {};
            const summaryLine = getMachineSummaryLine(p);

            return (
              <div
                key={p.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
              >
                {/* Header of Card */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 text-xl shadow-inner dark:from-slate-800 dark:to-slate-700">
                        {catInfo.icon}
                      </div>
                      <div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {catInfo.title}
                        </span>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className="text-xs font-bold text-amber-500">★ {p.rating || 5}</span>
                          {p.driver_name && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              • {p.driver_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions Menu */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditPartner(p)}
                        title="Tahrirlash"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeletePartner(p)}
                        title="O‘chirish"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Company / Machine Title */}
                  <h3 className="mt-3.5 text-base font-bold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                    {p.company_name}
                  </h3>

                  {/* License Plate (Gos Nomer) */}
                  {p.license_plate && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-extrabold tracking-wider text-slate-800 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      <span className="text-[10px] text-blue-600 dark:text-blue-400">UZ</span>
                      <span className="border-r border-slate-300 pr-1.5 dark:border-slate-600">{p.license_plate.slice(0, 2)}</span>
                      <span>{p.license_plate.slice(2).trim()}</span>
                    </div>
                  )}

                  {/* Dynamic Machine Parameters Badges */}
                  <div className="mt-3.5 flex flex-wrap gap-1.5">
                    {/* Avtokran */}
                    {p.service_category === 'avtokran' && (
                      <>
                        {specs.lifting_capacity && (
                          <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            Yuk: {specs.lifting_capacity}
                          </span>
                        )}
                        {specs.boom_length && (
                          <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                            Strela: {specs.boom_length}
                          </span>
                        )}
                        {specs.min_hours && (
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Min: {specs.min_hours}
                          </span>
                        )}
                        {specs.hourly_rate ? (
                          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            {formatCurrency(Number(specs.hourly_rate))} /soat
                          </span>
                        ) : null}
                      </>
                    )}

                    {/* Manipulyator */}
                    {p.service_category === 'manipulyator' && (
                      <>
                        {specs.body_capacity && (
                          <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            Bort yuk: {specs.body_capacity}
                          </span>
                        )}
                        {specs.crane_capacity && (
                          <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                            Strela: {specs.crane_capacity}
                          </span>
                        )}
                        {specs.body_length && (
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Uzunlik: {specs.body_length}
                          </span>
                        )}
                        {specs.hourly_rate ? (
                          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            {formatCurrency(Number(specs.hourly_rate))} /soat
                          </span>
                        ) : null}
                      </>
                    )}

                    {/* Avtolift */}
                    {p.service_category === 'avtolift' && (
                      <>
                        {specs.lift_height && (
                          <span className="rounded-lg bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                            Balandlik: {specs.lift_height}
                          </span>
                        )}
                        {specs.basket_capacity && (
                          <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                            Lyulka: {specs.basket_capacity}
                          </span>
                        )}
                        {specs.hourly_rate ? (
                          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            {formatCurrency(Number(specs.hourly_rate))} /soat
                          </span>
                        ) : null}
                        {specs.trip_price ? (
                          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            {formatCurrency(Number(specs.trip_price))} /reys
                          </span>
                        ) : null}
                      </>
                    )}

                    {/* Musor mashina */}
                    {p.service_category === 'musor' && (
                      <>
                        {specs.body_volume && (
                          <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                            Hajm: {specs.body_volume}
                          </span>
                        )}
                        {specs.tonnage && (
                          <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            Sig‘im: {specs.tonnage}
                          </span>
                        )}
                        {specs.trip_price ? (
                          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            {formatCurrency(Number(specs.trip_price))} /reys
                          </span>
                        ) : null}
                      </>
                    )}

                    {/* Gruzchik */}
                    {p.service_category === 'gruzchik' && (
                      <>
                        {specs.worker_count && (
                          <span className="rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            {specs.worker_count}
                          </span>
                        )}
                        {specs.rate_type === 'ogirlik' && specs.weight_rate && (
                          <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {specs.weight_rate}
                          </span>
                        )}
                        {specs.hourly_rate ? (
                          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            {formatCurrency(Number(specs.hourly_rate))} /soat
                          </span>
                        ) : null}
                      </>
                    )}

                    {/* Boshqa maxsus */}
                    {p.service_category === 'boshqa' && (
                      <>
                        {specs.custom_specs && (
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {specs.custom_specs}
                          </span>
                        )}
                        {specs.hourly_rate ? (
                          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            {formatCurrency(Number(specs.hourly_rate))} /soat
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>

                  {/* Notes / Izoh */}
                  {p.notes && (
                    <p className="mt-3 text-xs line-clamp-2 text-slate-500 dark:text-slate-400">
                      {p.notes}
                    </p>
                  )}
                </div>

                {/* Footer of Card with Phones & Status Toggle */}
                <div className="mt-5 border-t border-slate-100 pt-3.5 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    {/* Phone button */}
                    <a
                      href={`tel:${p.phone_primary}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>{normalizePhone(p.phone_primary) || 'Tel ko‘rsatilmagan'}</span>
                    </a>

                    {/* One-click Bo'sh/Band status toggle */}
                    <button
                      onClick={() => handleToggleAvailability(p)}
                      disabled={togglingId === p.id}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition shadow-xs ${
                        p.is_available
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                      }`}
                    >
                      {togglingId === p.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <span className={`h-2 w-2 rounded-full ${p.is_available ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      )}
                      <span>{p.is_available ? 'Bo‘sh' : 'Band'}</span>
                    </button>
                  </div>

                  {p.phone_secondary && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Qo‘shimcha: {normalizePhone(p.phone_secondary)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dynamic Partner Modal */}
      <Modal
        open={partnerModal}
        onClose={() => setPartnerModal(false)}
        title={editing ? "Hamkor texnikasini tahrirlash" : "Yangi texnika / Hamkor qo‘shish"}
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
          {/* 1. Xizmat kategoriyasi tanlash */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Xizmat kategoriyasi (Texnika turi) *
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SERVICE_CATEGORIES.map(cat => {
                const isSelected = partnerForm.service_category === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setPartnerForm(prev => ({ ...prev, service_category: cat.value }))}
                    className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-center transition ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm ring-2 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-900/30 dark:text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <span className="text-xl">{cat.icon}</span>
                    <span className="text-xs font-semibold leading-tight">{cat.titleUz}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* If "Boshqa" selected, enter custom machinery category name */}
          {partnerForm.service_category === 'boshqa' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 dark:border-amber-800 dark:bg-amber-950/20">
              <label className="mb-1.5 block text-xs font-bold text-amber-900 dark:text-amber-200">
                Maxsus texnika / Xizmat aniq nomi *
              </label>
              <input
                type="text"
                value={partnerForm.custom_category_name}
                onChange={e => setPartnerForm(prev => ({ ...prev, custom_category_name: e.target.value }))}
                placeholder="Masalan: Mini-ekskavator Bobcat, Katok, Betonopompa..."
                className="input-field bg-white dark:bg-slate-800"
              />
            </div>
          )}

          {/* 2. Dynamic Parameters Box according to chosen Category */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                {getCategoryInfo(partnerForm.service_category).title} — Texnik Parametrlari
              </h4>
            </div>

            {/* A) AVTOKRAN */}
            {partnerForm.service_category === 'avtokran' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Yuk ko‘tarish quvvati (Tonna)
                  </label>
                  <input
                    type="text"
                    value={partnerForm.specs.lifting_capacity || ''}
                    onChange={e => updateSpecField('lifting_capacity', e.target.value)}
                    placeholder="Masalan: 16t, 25t, 50t"
                    className="input-field bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Strela uzunligi (Metr)
                  </label>
                  <input
                    type="text"
                    value={partnerForm.specs.boom_length || ''}
                    onChange={e => updateSpecField('boom_length', e.target.value)}
                    placeholder="Masalan: 21m, 28m, 35m, 42m"
                    className="input-field bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Soatlik ijara narxi (so‘m/soat)
                  </label>
                  <input
                    type="number"
                    value={partnerForm.specs.hourly_rate || ''}
                    onChange={e => updateSpecField('hourly_rate', e.target.value)}
                    placeholder="Masalan: 400000"
                    className="input-field bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Minimal ish vaqti
                  </label>
                  <input
                    type="text"
                    value={partnerForm.specs.min_hours || ''}
                    onChange={e => updateSpecField('min_hours', e.target.value)}
                    placeholder="Masalan: kamida 2 soat"
                    className="input-field bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
            )}

            {/* B) MANIPULYATOR */}
            {partnerForm.service_category === 'manipulyator' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Bort yuk ko‘tarishi (Tonna)
                  </label>
                  <input
                    type="text"
                    value={partnerForm.specs.body_capacity || ''}
                    onChange={e => updateSpecField('body_capacity', e.target.value)}
                    placeholder="Masalan: 5t, 10t, 15t"
                    className="input-field bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Strela kran quvvati (Tonna)
                  </label>
                  <input
                    type="text"
                    value={partnerForm.specs.crane_capacity || ''}
                    onChange={e => updateSpecField('crane_capacity', e.target.value)}
                    placeholder="Masalan: 3t, 5t, 7t"
                    className="input-field bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Bort uzunligi (Metr)
                  </label>
                  <input
                    type="text"
                    value={partnerForm.specs.body_length || ''}
                    onChange={e => updateSpecField('body_length', e.target.value)}
                    placeholder="Masalan: 6 metr, 7.5 metr"
                    className="input-field bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Soatlik ijara narxi (so‘m/soat)
                  </label>
                  <input
                    type="number"
                    value={partnerForm.specs.hourly_rate || ''}
                    onChange={e => updateSpecField('hourly_rate', e.target.value)}
                    placeholder="Masalan: 350000"
                    className="input-field bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
            )}

            {/* C) AVTOLIFT (FASAD LIFTI) */}
            {partnerForm.service_category === 'avtolift' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Maksimal ko‘tarish balandligi
                  </label>
                  <input
                    type="text"
                    value={partnerForm.specs.lift_height || ''}
                    onChange={e => updateSpecField('lift_height', e.target.value)}
                    placeholder="Masalan: 12-qavat / 35 metr"
                    className="input-field bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Lyulka yuk ko‘tarish vazni (kg)
                  </label>
                  <input
                    type="text"
                    value={partnerForm.specs.basket_capacity || ''}
                    onChange={e => updateSpecField('basket_capacity', e.target.value)}
                    placeholder="Masalan: 300 kg, 400 kg, 500 kg"
                    className="input-field bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Soatlik narx (so‘m/soat)
                  </label>
                  <input
                    type="number"
                    value={partnerForm.specs.hourly_rate || ''}
                    onChange={e => updateSpecField('hourly_rate', e.target.value)}
                    placeholder="Masalan: 300000"
                    className="input-field bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Yoki 1 reys narxi (so‘m)
                  </label>
                  <input
                    type="number"
                    value={partnerForm.specs.trip_price || ''}
                    onChange={e => updateSpecField('trip_price', e.target.value)}
                    placeholder="Masalan: 400000"
                    className="input-field bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
            )}

            {/* D) MUSOR MASHINA */}
            {partnerForm.service_category === 'musor' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Kuzov hajmi (m³)
                  </label>
                  <input
                    type="text"
                    value={partnerForm.specs.body_volume || ''}
                    onChange={e => updateSpecField('body_volume', e.target.value)}
                    placeholder="Masalan: 8 m³, 16 m³, 20 m³"
                    className="input-field bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Yuk sig‘imi (Tonna)
                  </label>
                  <input
                    type="text"
                    value={partnerForm.specs.tonnage || ''}
                    onChange={e => updateSpecField('tonnage', e.target.value)}
                    placeholder="Masalan: 3t, 5t, 10t"
                    className="input-field bg-white dark:bg-slate-800"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    1 reys narxi (so‘m/reys)
                  </label>
                  <input
                    type="number"
                    value={partnerForm.specs.trip_price || ''}
                    onChange={e => updateSpecField('trip_price', e.target.value)}
                    placeholder="Masalan: 450000"
                    className="input-field bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
            )}

            {/* E) GRUZCHIK */}
            {partnerForm.service_category === 'gruzchik' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Ishchilar soni (kishi)
                  </label>
                  <input
                    type="text"
                    value={partnerForm.specs.worker_count || ''}
                    onChange={e => updateSpecField('worker_count', e.target.value)}
                    placeholder="Masalan: 2 kishi, 4 kishi, 6 kishi"
                    className="input-field bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Tarif hisoblash usuli
                  </label>
                  <select
                    value={partnerForm.specs.rate_type || 'soatlik'}
                    onChange={e => updateSpecField('rate_type', e.target.value)}
                    className="input-field bg-white dark:bg-slate-800"
                  >
                    <option value="soatlik">Soatlik tarif</option>
                    <option value="ogirlik">Og‘irlik / Hajm tarifi</option>
                  </select>
                </div>
                {partnerForm.specs.rate_type === 'ogirlik' ? (
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Og‘irlik tarifi (kg yoki qop uchun)
                    </label>
                    <input
                      type="text"
                      value={partnerForm.specs.weight_rate || ''}
                      onChange={e => updateSpecField('weight_rate', e.target.value)}
                      placeholder="Masalan: 150 so'm/kg yoki 5000 so'm/qop"
                      className="input-field bg-white dark:bg-slate-800"
                    />
                  </div>
                ) : (
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Soatlik ish haqi (so‘m/soat)
                    </label>
                    <input
                      type="number"
                      value={partnerForm.specs.hourly_rate || ''}
                      onChange={e => updateSpecField('hourly_rate', e.target.value)}
                      placeholder="Masalan: 80000"
                      className="input-field bg-white dark:bg-slate-800"
                    />
                  </div>
                )}
              </div>
            )}

            {/* F) BOSHQA MAXSUS TEXNIKA */}
            {partnerForm.service_category === 'boshqa' && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Texnikaning asosiy ko‘rsatkichlari / parametrlari
                  </label>
                  <input
                    type="text"
                    value={partnerForm.specs.custom_specs || ''}
                    onChange={e => updateSpecField('custom_specs', e.target.value)}
                    placeholder="Masalan: Kovsh 0.3 m³, Chuqurlik 2.5m, Gidromolot mavjud..."
                    className="input-field bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Ijara narxi (so‘m/soat yoki smena)
                  </label>
                  <input
                    type="number"
                    value={partnerForm.specs.hourly_rate || ''}
                    onChange={e => updateSpecField('hourly_rate', e.target.value)}
                    placeholder="Masalan: 300000"
                    className="input-field bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. UMUMIY MA'LUMOTLAR */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Umumiy ma’lumotlar va aloqa
            </h4>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Texnika / Kompaniya nomi *
                </label>
                <input
                  type="text"
                  required
                  value={partnerForm.company_name}
                  onChange={e => setPartnerForm({ ...partnerForm, company_name: e.target.value })}
                  placeholder="Masalan: Kamaz Avtokran 25t (Xurshid aka)"
                  className="input-field"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Haydovchi F.I.O
                </label>
                <input
                  type="text"
                  value={partnerForm.driver_name}
                  onChange={e => setPartnerForm({ ...partnerForm, driver_name: e.target.value })}
                  placeholder="Masalan: Xurshid Rahimov"
                  className="input-field"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Davlat raqami (Gos nomer)
                </label>
                <input
                  type="text"
                  value={partnerForm.license_plate}
                  onChange={e => setPartnerForm({ ...partnerForm, license_plate: e.target.value })}
                  placeholder="01 777 AAB"
                  className="input-field uppercase font-mono tracking-wider"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Asosiy telefon (+998...) *
                </label>
                <input
                  type="tel"
                  required
                  value={partnerForm.phone_primary}
                  onChange={e => setPartnerForm({ ...partnerForm, phone_primary: e.target.value })}
                  placeholder="+998 90 123 45 67"
                  className="input-field"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Qo‘shimcha telefon
                </label>
                <input
                  type="tel"
                  value={partnerForm.phone_secondary}
                  onChange={e => setPartnerForm({ ...partnerForm, phone_secondary: e.target.value })}
                  placeholder="+998 99 765 43 21"
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                Izoh va qo‘shimcha ma’lumotlar
              </label>
              <textarea
                value={partnerForm.notes}
                onChange={e => setPartnerForm({ ...partnerForm, notes: e.target.value })}
                rows={2}
                placeholder="Ruxsatnomalar, turargoh joylashuvi, tajriba yoki shartlar haqida eslatma..."
                className="input-field"
              />
            </div>

            {/* Holati Bo'sh / Band checkbox */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={partnerForm.is_available}
                  onChange={e => setPartnerForm({ ...partnerForm, is_available: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Hozirda bo‘sh (Buyurtmalarni qabul qilishga tayyor)
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Belgilansa yashil «Bo‘sh», aks holda «Band» qilib belgilanadi
                  </p>
                </div>
              </label>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                partnerForm.is_available ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {partnerForm.is_available ? 'Bo‘sh' : 'Band'}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setPartnerModal(false)}
              className="btn-ghost"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleSavePartner}
              disabled={saving || !partnerForm.company_name.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span>{t('save')}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletePartner}
        onClose={() => setDeletePartner(null)}
        onConfirm={handleDeletePartner}
        title="Texnikani o‘chirish"
        message={`«${deletePartner?.company_name}» ma'lumotlarini ro‘yxatdan o‘chirishni tasdiqlaysizmi?`}
      />
    </div>
  );
}
