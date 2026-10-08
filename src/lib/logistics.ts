import type {
  CargoItem, Equipment, EquipmentSettings, FloorPricing, GruzchikQuote, KranQuote, LiftType,
  LoaderSettings, MusirQuote, WasteSettings, WasteType, WasteVehicle,
} from '@/types/logistics';

export type SelectionMap = Record<string, number>;

function round(n: number): number {
  return Math.round(n);
}

export function floorPricingFor(rows: FloorPricing[], floor: number): FloorPricing | undefined {
  return rows.find(r => floor >= r.from_floor && floor <= r.to_floor);
}

export function calculateGruzchik(
  cargo: CargoItem[],
  selection: SelectionMap,
  floor: number,
  lift: LiftType | undefined,
  distance: number,
  settings: LoaderSettings,
  floors: FloorPricing[],
): GruzchikQuote {
  const lines = cargo.filter(c => (selection[c.id] ?? 0) > 0);
  const items = lines.map(c => ({ item: c, qty: selection[c.id] }));
  const total_items = items.reduce((s, l) => s + l.qty, 0);
  const total_weight = items.reduce((s, l) => s + l.qty * Number(l.item.weight_kg), 0);

  const capacity = Math.max(1, Number(settings.worker_capacity_kg) * Number(lift?.capacity_multiplier ?? 1));
  const workers = total_weight > 0 ? Math.max(1, Math.ceil(total_weight / capacity)) : 1;

  const fp = floorPricingFor(floors, floor);
  const perItemSurcharge = round(total_items * Number(fp?.surcharge_per_item ?? 0));
  const perWorkerSurcharge = round(workers * Number(fp?.surcharge_per_worker ?? 0));

  const freeDistance = Number(settings.free_distance_m ?? 0);
  const paidDistance = Math.max(0, distance - freeDistance);
  const distanceSurcharge = round(Math.ceil(paidDistance / 10) * Number(settings.price_per_10m ?? 0));

  const itemsPrice = items.reduce((s, l) => s + l.qty * Number(l.item.price), 0);
  const basePrice = itemsPrice + perItemSurcharge + perWorkerSurcharge + distanceSurcharge;
  const multiplier = Number(lift?.price_multiplier ?? 1);
  const lifted = round(basePrice * multiplier);

  const total = Math.max(lifted, Number(settings.min_order ?? 0));

  const time_hours = total_weight > 0 ? Math.max(1, Math.ceil(total_weight / capacity / 2)) : 1;

  return {
    total_weight: round(total_weight),
    workers,
    time_hours,
    breakdown: [
      { label: 'itemsPrice', amount: round(itemsPrice) },
      { label: 'floorSurcharge', amount: perItemSurcharge + perWorkerSurcharge },
      { label: 'distanceSurcharge', amount: distanceSurcharge },
      ...(multiplier !== 1 ? [{ label: 'liftSurcharge' as const, amount: lifted - basePrice }] : []),
      ...(total > lifted ? [{ label: 'minOrderApplied' as const, amount: total - lifted }] : []),
    ],
    total,
  };
}

export function calculateManualForWeight(
  totalWeight: number,
  floor: number,
  distance: number,
  settings: LoaderSettings,
  floors: FloorPricing[],
  itemCount = 1,
): number {
  const fp = floorPricingFor(floors, floor);
  const workers = Math.max(1, Math.ceil(totalWeight / Math.max(1, Number(settings.worker_capacity_kg))));
  const freeDistance = Number(settings.free_distance_m ?? 0);
  const distanceSurcharge = Math.max(0, distance - freeDistance) === 0
    ? 0
    : Math.ceil(Math.max(0, distance - freeDistance) / 10) * Number(settings.price_per_10m ?? 0);
  const sum = workers * Number(settings.hourly_rate ?? 0)
    + itemCount * Number(fp?.surcharge_per_item ?? 0)
    + workers * Number(fp?.surcharge_per_worker ?? 0)
    + distanceSurcharge;
  return Math.max(sum, Number(settings.min_order ?? 0));
}

export function calculateKran(
  equipment: Equipment | undefined,
  cargoWeight: number,
  hours: number,
  km: number,
  settings: EquipmentSettings,
  manualTotal: number,
): KranQuote {
  const hourly = round(Number(equipment?.hourly_rate ?? 0) * hours);
  const kmFee = round(km * Number(settings.km_price ?? 0));
  const mobilization = round(Number(settings.mobilization_fee ?? 0));
  const total = hourly + kmFee + mobilization;

  const recommendation: KranQuote['recommendation'] = total === manualTotal ? 'equal' : total < manualTotal ? 'kran' : 'manual';
  const difference = Math.abs(total - manualTotal);

  return {
    breakdown: [
      { label: 'hourlyCost', amount: hourly, hint: `${equipment?.name ?? ''} · ${hours} soat` },
      { label: 'kmFee', amount: kmFee, hint: `${km} km` },
      { label: 'mobilization', amount: mobilization },
    ],
    total,
    manual_total: manualTotal,
    recommendation,
    difference,
  };
}

export function calculateMusir(
  type: WasteType | undefined,
  volume: number,
  unit: 'm3' | 'ton',
  vehicle: WasteVehicle | undefined,
  km: number,
  loadersEnabled: boolean,
  loaders: number,
  floor: number,
  settings: WasteSettings,
  loaderSettings: LoaderSettings,
): MusirQuote {
  const density = Number(type?.density_ton_m3 ?? 0);
  const volumeM3 = unit === 'm3' ? volume : (density > 0 ? volume / density : volume);
  const tons = unit === 'ton' ? volume : volume * density;

  const capacityM3 = Number(vehicle?.capacity_m3 ?? 1);
  const capacityTon = Number(vehicle?.capacity_ton ?? 1);
  const byVolume = Math.ceil(volumeM3 / Math.max(0.0001, capacityM3));
  const byTon = capacityTon > 0 ? Math.ceil(tons / capacityTon) : 1;
  const trips = Math.max(1, Math.max(byVolume, byTon));

  const multiplier = Number(type?.price_multiplier ?? 1);
  const vehicleFee = round(trips * Number(vehicle?.base_price ?? 0) * multiplier);
  const kmFee = round(km * Number(vehicle?.km_price ?? 0) * trips);

  const loadingFee = loadersEnabled
    ? round(loaders * Number(loaderSettings.hourly_rate ?? 0) + Math.max(0, floor - 1) * Number(settings.floor_surcharge_per_floor ?? 0))
    : round(Number(settings.loader_fee ?? 0) * trips);

  return {
    trips,
    tons: round(tons * 10) / 10,
    suggested_vehicle_id: vehicle?.id ?? '',
    breakdown: [
      { label: 'vehicleFee', amount: vehicleFee, hint: `${trips} qatnov` },
      ...(kmFee > 0 ? [{ label: 'kmFee' as const, amount: kmFee }] : []),
      ...(loadingFee > 0 ? [{ label: 'loadingFee' as const, amount: loadingFee }] : []),
    ],
    total: vehicleFee + kmFee + loadingFee,
  };
}

export function suggestVehicle(vehicles: WasteVehicle[], volumeM3: number, tons: number): WasteVehicle | undefined {
  const active = vehicles.filter(v => v.active);
  for (const v of active) {
    if (volumeM3 <= Number(v.capacity_m3) && tons <= Number(v.capacity_ton)) return v;
  }
  const largest = active.sort((a, b) => Number(b.capacity_m3) - Number(a.capacity_m3))[0];
  return largest;
}
