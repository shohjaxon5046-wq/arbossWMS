import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  CargoItem, Equipment, EquipmentSettings, FloorPricing, LiftType, LoaderSettings, LogisticsPricingData,
  WasteSettings, WasteType, WasteVehicle,
} from '@/types/logistics';

const emptyData: LogisticsPricingData = {
  cargo_items: [],
  floor_pricing: [],
  lift_types: [],
  loader_settings: { worker_capacity_kg: 50, hourly_rate: 60000, free_distance_m: 10, price_per_10m: 15000, min_order: 80000 },
  equipment: [],
  equipment_settings: { km_price: 15000, mobilization_fee: 250000 },
  waste_vehicles: [],
  waste_types: [],
  waste_settings: { loader_fee: 150000, floor_surcharge_per_floor: 15000 },
};

function settingsRows<T>(rows: { key: string; value: number }[]): T {
  const out = {} as Record<string, number>;
  for (const r of rows) out[r.key] = Number(r.value);
  return out as T;
}

export function useLogisticsPricing(includeInactive = false) {
  const [data, setData] = useState<LogisticsPricingData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const activeQuery = (table: string) => {
        let q = supabase.from(table).select('*');
        if (!includeInactive) q = q.eq('active', true);
        return q;
      };
      const [cargo, floors, lifts, lset, equip, eqset, vehicles, types, wset] = await Promise.all([
        activeQuery('cargo_items').order('sort').order('name'),
        supabase.from('floor_pricing').select('*').order('from_floor'),
        activeQuery('lift_types').order('name'),
        supabase.from('loader_settings').select('*'),
        activeQuery('equipment').order('name'),
        supabase.from('equipment_settings').select('*'),
        activeQuery('waste_vehicles').order('capacity_m3'),
        activeQuery('waste_types').order('name'),
        supabase.from('waste_settings').select('*'),
      ]);
      const errs = [cargo, floors, lifts, lset, equip, eqset, vehicles, types, wset].filter(r => r.error);
      if (errs.length) throw errs[0].error;

      setData({
        cargo_items: (cargo.data ?? []) as CargoItem[],
        floor_pricing: (floors.data ?? []) as FloorPricing[],
        lift_types: (lifts.data ?? []) as LiftType[],
        loader_settings: { ...emptyData.loader_settings, ...settingsRows<LoaderSettings>((lset.data ?? []) as { key: string; value: number }[]) },
        equipment: (equip.data ?? []) as Equipment[],
        equipment_settings: { ...emptyData.equipment_settings, ...settingsRows<EquipmentSettings>((eqset.data ?? []) as { key: string; value: number }[]) },
        waste_vehicles: (vehicles.data ?? []) as WasteVehicle[],
        waste_types: (types.data ?? []) as WasteType[],
        waste_settings: { ...emptyData.waste_settings, ...settingsRows<WasteSettings>((wset.data ?? []) as { key: string; value: number }[]) },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'load_error');
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}
