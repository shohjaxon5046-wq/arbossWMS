export type LogisticsService = 'gruzchik' | 'kran' | 'musir';
export type LogisticsOrderStatus = 'yangi' | 'jarayonda' | 'bajarildi' | 'bekor';

export interface CargoItem {
  id: string;
  name: string;
  weight_kg: number;
  price: number;
  unit: string;
  active: boolean;
  sort: number;
}

export interface FloorPricing {
  id: string;
  from_floor: number;
  to_floor: number;
  surcharge_per_item: number;
  surcharge_per_worker: number;
}

export interface LiftType {
  id: string;
  name: string;
  capacity_multiplier: number;
  price_multiplier: number;
  active: boolean;
}

export interface LoaderSettings {
  worker_capacity_kg: number;
  hourly_rate: number;
  free_distance_m: number;
  price_per_10m: number;
  min_order: number;
}

export interface Equipment {
  id: string;
  name: string;
  hourly_rate: number;
  capacity_kg: number;
  max_height_m: number;
  min_hours: number;
  active: boolean;
}

export interface EquipmentSettings {
  km_price: number;
  mobilization_fee: number;
}

export interface WasteVehicle {
  id: string;
  name: string;
  capacity_m3: number;
  capacity_ton: number;
  base_price: number;
  km_price: number;
  active: boolean;
}

export interface WasteType {
  id: string;
  name: string;
  density_ton_m3: number;
  price_multiplier: number;
  active: boolean;
}

export interface WasteSettings {
  loader_fee: number;
  floor_surcharge_per_floor: number;
}

export interface LogisticsOrder {
  id: string;
  order_number: string;
  service: LogisticsService;
  customer_name: string;
  customer_phone: string;
  address: string;
  datetime: string | null;
  note: string;
  details: Record<string, unknown>;
  estimated_price: number;
  status: LogisticsOrderStatus;
  created_by: string;
  seller_name: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface LogisticsOrderHistory {
  id: string;
  order_id: string;
  changed_by: string;
  old_status: string;
  new_status: string;
  changed_at: string;
  changer_name?: string;
}

export interface LogisticsPricingData {
  cargo_items: CargoItem[];
  floor_pricing: FloorPricing[];
  lift_types: LiftType[];
  loader_settings: LoaderSettings;
  equipment: Equipment[];
  equipment_settings: EquipmentSettings;
  waste_vehicles: WasteVehicle[];
  waste_types: WasteType[];
  waste_settings: WasteSettings;
}

export interface PriceBreakdown {
  label: string;
  amount: number;
  hint?: string;
  accent?: 'positive' | 'negative';
  bold?: boolean;
}

export interface GruzchikQuote {
  total_weight: number;
  workers: number;
  time_hours: number;
  breakdown: PriceBreakdown[];
  total: number;
}

export interface KranQuote {
  breakdown: PriceBreakdown[];
  total: number;
  manual_total: number;
  recommendation: 'kran' | 'manual' | 'equal';
  difference: number;
}

export interface MusirQuote {
  trips: number;
  tons: number;
  suggested_vehicle_id: string;
  breakdown: PriceBreakdown[];
  total: number;
}
