import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { useLogisticsPricing } from '@/lib/useLogisticsPricing';
import { CrudTable, SettingsEditor } from '@/components/logistics/CrudTable';
import { AdminLogisticsOrders } from '@/components/logistics/AdminLogisticsOrders';
import { LoadingSpinner, ErrorState } from '@/components/ui/States';
import type { LogisticsService } from '@/types/logistics';
type EditorKind = 'orders' | LogisticsService;

const tabs: { id: EditorKind; labelKey: 'loOrders' | 'adminGruzchik' | 'adminKran' | 'adminMusir' }[] = [
  { id: 'orders', labelKey: 'loOrders' },
  { id: 'gruzchik', labelKey: 'adminGruzchik' },
  { id: 'kran', labelKey: 'adminKran' },
  { id: 'musir', labelKey: 'adminMusir' },
];

export function AdminLogisticsPage() {
  const { t } = useApp();
  const [tab, setTab] = useState<EditorKind>('orders');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {tabs.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === tb.id ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
            {t(tb.labelKey)}
          </button>
        ))}
      </div>
      {tab === 'orders' ? <AdminLogisticsOrders /> : <PricingEditor service={tab} />}
    </div>
  );
}

function PricingEditor({ service }: { service: LogisticsService }) {
  const { t } = useApp();
  const { data, loading, error, reload } = useLogisticsPricing(true);
  const [subTab, setSubTab] = useState(0);

  if (loading) return <LoadingSpinner text={t('loading')} />;
  if (error) return <ErrorState message={error} />;

  const save = async (table: string, id: string | null, values: Record<string, unknown>) => {
    const { error: err } = id
      ? await supabase.from(table).update(values).eq('id', id)
      : await supabase.from(table).insert(values);
    if (err) window.alert(err.message);
    await reload();
  };

  const remove = async (table: string, id: string) => {
    const { error: err } = await supabase.from(table).delete().eq('id', id);
    if (err) window.alert(err.message);
    await reload();
  };

  const saveKv = async (table: string, key: string, value: number) => {
    const { error: err } = await supabase.from(table).upsert({ key, value }, { onConflict: 'key' });
    if (err) window.alert(err.message);
    await reload();
  };

  if (service === 'kran') {
    const tabs2: { labelKey: 'equipmentTab' | 'equipSettingsTab' }[] = [
      { labelKey: 'equipmentTab' },
      { labelKey: 'equipSettingsTab' },
    ];
    return (
      <div className="space-y-3">
        <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {tabs2.map((tb, i) => (
            <button key={tb.labelKey} onClick={() => setSubTab(i)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${subTab === i ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>
              {t(tb.labelKey)}
            </button>
          ))}
        </div>
        {subTab === 0 ? (
          <CrudTable
            rows={data.equipment as unknown as Record<string, unknown>[]}
            columns={[
              { key: 'name', label: t('colName'), required: true },
              { key: 'hourly_rate', label: t('colHourlyRate'), type: 'money', required: true },
              { key: 'capacity_kg', label: t('colCapacityKg'), type: 'number', required: true },
              { key: 'max_height_m', label: t('colMaxHeightM'), type: 'number', required: true },
              { key: 'min_hours', label: t('colMinHours'), type: 'number', required: true },
              { key: 'active', label: t('colActive'), type: 'boolean' },
            ]}
            onSave={(id, v) => save('equipment', id, v)}
            onDelete={id => remove('equipment', id)}
          />
        ) : (
          <SettingsEditor rows={[{ key: 'km_price', value: data.equipment_settings.km_price }, { key: 'mobilization_fee', value: data.equipment_settings.mobilization_fee }]} onSave={(k, v) => saveKv('equipment_settings', k, v)} />
        )}
      </div>
    );
  }

  if (service === 'gruzchik') {
    const tabs2: { labelKey: 'cargoTab' | 'floorTab' | 'liftTab' | 'loaderTab' }[] = [
      { labelKey: 'cargoTab' }, { labelKey: 'floorTab' }, { labelKey: 'liftTab' }, { labelKey: 'loaderTab' },
    ];
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {tabs2.map((tb, i) => (
            <button key={tb.labelKey} onClick={() => setSubTab(i)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${subTab === i ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>
              {t(tb.labelKey)}
            </button>
          ))}
        </div>
        {subTab === 0 && (
          <CrudTable
            rows={data.cargo_items as unknown as Record<string, unknown>[]}
            columns={[
              { key: 'name', label: t('colName'), required: true },
              { key: 'weight_kg', label: t('colWeightKg'), type: 'number', required: true },
              { key: 'price', label: t('colPrice'), type: 'money', required: true },
              { key: 'unit', label: t('colUnit'), shownInForm: true },
              { key: 'sort', label: t('colSort'), type: 'number' },
              { key: 'active', label: t('colActive'), type: 'boolean' },
            ]}
            onSave={(id, v) => save('cargo_items', id, v)}
            onDelete={id => remove('cargo_items', id)}
          />
        )}
        {subTab === 1 && (
          <CrudTable
            rows={data.floor_pricing as unknown as Record<string, unknown>[]}
            columns={[
              { key: 'from_floor', label: t('colFromFloor'), type: 'number', required: true },
              { key: 'to_floor', label: t('colToFloor'), type: 'number', required: true },
              { key: 'surcharge_per_item', label: t('colPerItem'), type: 'money', required: true },
              { key: 'surcharge_per_worker', label: t('colPerWorker'), type: 'money', required: true },
            ]}
            onSave={(id, v) => save('floor_pricing', id, v)}
            onDelete={id => remove('floor_pricing', id)}
          />
        )}
        {subTab === 2 && (
          <CrudTable
            rows={data.lift_types as unknown as Record<string, unknown>[]}
            columns={[
              { key: 'name', label: t('colName'), required: true },
              { key: 'capacity_multiplier', label: t('colCapacityMult'), type: 'number', required: true },
              { key: 'price_multiplier', label: t('colPriceMult'), type: 'number', required: true },
              { key: 'active', label: t('colActive'), type: 'boolean' },
            ]}
            onSave={(id, v) => save('lift_types', id, v)}
            onDelete={id => remove('lift_types', id)}
          />
        )}
        {subTab === 3 && (
          <SettingsEditor rows={[
            { key: 'worker_capacity_kg', value: data.loader_settings.worker_capacity_kg },
            { key: 'hourly_rate', value: data.loader_settings.hourly_rate },
            { key: 'free_distance_m', value: data.loader_settings.free_distance_m },
            { key: 'price_per_10m', value: data.loader_settings.price_per_10m },
            { key: 'min_order', value: data.loader_settings.min_order },
          ]} onSave={(k, v) => saveKv('loader_settings', k, v)} />
        )}
      </div>
    );
  }

  const tabs2: { labelKey: 'wasteTypesTab' | 'vehiclesTab' | 'wasteSettingsTab' }[] = [
    { labelKey: 'wasteTypesTab' }, { labelKey: 'vehiclesTab' }, { labelKey: 'wasteSettingsTab' },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        {tabs2.map((tb, i) => (
          <button key={tb.labelKey} onClick={() => setSubTab(i)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${subTab === i ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500'}`}>
            {t(tb.labelKey)}
          </button>
        ))}
      </div>
      {subTab === 0 && (
        <CrudTable
          rows={data.waste_types as unknown as Record<string, unknown>[]}
          columns={[
            { key: 'name', label: t('colName'), required: true },
            { key: 'density_ton_m3', label: t('colDensity'), type: 'number', required: true },
            { key: 'price_multiplier', label: t('colPriceMult'), type: 'number', required: true },
            { key: 'active', label: t('colActive'), type: 'boolean' },
          ]}
          onSave={(id, v) => save('waste_types', id, v)}
          onDelete={id => remove('waste_types', id)}
        />
      )}
      {subTab === 1 && (
        <CrudTable
          rows={data.waste_vehicles as unknown as Record<string, unknown>[]}
          columns={[
            { key: 'name', label: t('colName'), required: true },
            { key: 'capacity_m3', label: t('colCapacityM3'), type: 'number', required: true },
            { key: 'capacity_ton', label: t('colCapacityTon'), type: 'number', required: true },
            { key: 'base_price', label: t('colBasePrice'), type: 'money', required: true },
            { key: 'km_price', label: t('colKmPrice'), type: 'money', required: true },
            { key: 'active', label: t('colActive'), type: 'boolean' },
          ]}
          onSave={(id, v) => save('waste_vehicles', id, v)}
          onDelete={id => remove('waste_vehicles', id)}
        />
      )}
      {subTab === 2 && (
        <SettingsEditor rows={[
          { key: 'loader_fee', value: data.waste_settings.loader_fee },
          { key: 'floor_surcharge_per_floor', value: data.waste_settings.floor_surcharge_per_floor },
        ]} onSave={(k, v) => saveKv('waste_settings', k, v)} />
      )}
    </div>
  );
}
