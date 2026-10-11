import { describe, it, expect } from 'vitest';
import { rentDiscountPct, rentLineTotal } from '@/lib/orders';
import { calculateGruzchik, calculateKran, calculateMusir } from '@/lib/logistics';
import type { ProductModel } from '@/types';
import type {
  CargoItem, Equipment, EquipmentSettings, FloorPricing, LiftType,
  LoaderSettings, WasteSettings, WasteType, WasteVehicle
} from '@/types/logistics';

describe('Order Rental & Logistics Calculations', () => {
  const sampleModel: ProductModel = {
    id: 'm-1',
    name: 'Perforator Bosch GBH 2-26',
    category: 'Elektr asboblari',
    brand: 'Bosch',
    model_code: 'GBH 2-26',
    daily_price: 80000,
    hourly_price: 15000,
    deposit_amount: 300000,
    description: '',
    image_url: '',
    specs: {},
    kit_items: [],
    consumables: [],
    depreciation_pct: 0,
    weekly_discount_pct: 15,
    monthly_discount_pct: 30,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('correctly calculates rental discount percentages based on weekly and monthly thresholds', () => {
    expect(rentDiscountPct(sampleModel, 1)).toBe(0);
    expect(rentDiscountPct(sampleModel, 6)).toBe(0);
    expect(rentDiscountPct(sampleModel, 7)).toBe(15);
    expect(rentDiscountPct(sampleModel, 14)).toBe(15);
    expect(rentDiscountPct(sampleModel, 30)).toBe(30);
    expect(rentDiscountPct(sampleModel, 45)).toBe(30);
  });

  it('correctly computes rental line total with discount applied', () => {
    // 1 day: 80 000
    expect(rentLineTotal(sampleModel, 1)).toBe(80000);

    // 7 days: 7 * 80 000 = 560 000, with 15% discount = 476 000
    expect(rentLineTotal(sampleModel, 7)).toBe(476000);

    // 30 days: 30 * 80 000 = 2 400 000, with 30% discount = 1 680 000
    expect(rentLineTotal(sampleModel, 30)).toBe(1680000);
  });

  it('calculates Gruzchik loader quote with item weights, floor surcharge, and minimum order rules', () => {
    const cargo: CargoItem[] = [
      { id: 'c1', name: 'Sement (50kg)', weight_kg: 50, price: 5000, unit: 'qop', active: true, sort: 1 },
      { id: 'c2', name: 'Gipsokarton', weight_kg: 30, price: 4000, unit: 'dona', active: true, sort: 2 },
    ];
    const selection = { c1: 20, c2: 10 }; // 1000kg + 300kg = 1300kg
    const lift: LiftType = { id: 'l1', name: 'Yuk lifti', capacity_multiplier: 1.5, price_multiplier: 0.8, active: true };
    const loaderSettings: LoaderSettings = {
      worker_capacity_kg: 250,
      min_order: 100000,
      hourly_rate: 60000,
      free_distance_m: 20,
      price_per_10m: 10000,
    };
    const floors: FloorPricing[] = [
      { id: 'f1', from_floor: 1, to_floor: 1, surcharge_per_item: 0, surcharge_per_worker: 0 },
      { id: 'f2', from_floor: 2, to_floor: 5, surcharge_per_item: 2000, surcharge_per_worker: 20000 },
    ];

    const quote = calculateGruzchik(cargo, selection, 3, lift, 50, loaderSettings, floors);

    expect(quote.total_weight).toBe(1300);
    expect(quote.workers).toBeGreaterThanOrEqual(2);
    expect(quote.total).toBeGreaterThan(0);
    expect(quote.breakdown.length).toBeGreaterThan(0);
  });

  it('calculates crane quote with equipment hourly cost, mileage, and mobilization', () => {
    const equipment: Equipment = {
      id: 'eq-1',
      name: 'Avtokran 25t Kamaz',
      capacity_kg: 25000,
      max_height_m: 28,
      min_hours: 3,
      hourly_rate: 350000,
      active: true,
    };
    const settings: EquipmentSettings = {
      km_price: 25000,
      mobilization_fee: 150000,
    };

    const quote = calculateKran(equipment, 5000, 4, 15, settings, 2000000);

    // 4 hours * 350 000 = 1 400 000 + (15 * 25 000 = 375 000) + 150 000 = 1 925 000
    expect(quote.total).toBe(1925000);
    expect(quote.breakdown.length).toBe(3);
    expect(quote.recommendation).toBe('kran'); // 1 925 000 < 2 000 000
  });

  it('calculates waste disposal quote with vehicle capacity, trips, and multiplier', () => {
    const wasteType: WasteType = {
      id: 'wt-1',
      name: 'Qurilish chiqindisi',
      density_ton_m3: 1.2,
      price_multiplier: 1.1,
      active: true,
    };
    const vehicle: WasteVehicle = {
      id: 'v-1',
      name: 'ZIL Samosval 5t',
      capacity_m3: 6,
      capacity_ton: 5,
      base_price: 500000,
      km_price: 15000,
      active: true,
    };
    const wasteSettings: WasteSettings = {
      loader_fee: 100000,
      floor_surcharge_per_floor: 15000,
    };
    const loaderSettings: LoaderSettings = {
      hourly_rate: 50000,
      worker_capacity_kg: 200,
      min_order: 80000,
      free_distance_m: 10,
      price_per_10m: 5000,
    };

    const quote = calculateMusir(
      wasteType,
      10, // 10 m3
      'm3',
      vehicle,
      20, // 20 km
      true, // loadersEnabled
      2, // 2 loaders
      4, // 4th floor
      wasteSettings,
      loaderSettings
    );

    // 10m3 * 1.2 density = 12 tons. Vehicle capacity is 5 tons, so ceil(12/5) = 3 trips
    expect(quote.trips).toBe(3);
    expect(quote.total).toBeGreaterThan(0);
    expect(quote.breakdown.length).toBeGreaterThan(0);
  });
});
