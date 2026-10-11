/**
 * Qurilish texnikalarining transport xarajatlarini masofa va yuk turiga qarab
 * hisoblovchi logistika kalkulyatori xizmati.
 * Yoqilg'i sarfi (l/100km, yuk koeffitsiyenti) va haydovchi xizmat haqi
 * (soatlik, km bo'yicha yoki reys bo'yicha) avtomatik hisoblanadi.
 */

export type FuelType = 'dizel' | 'metan' | 'benzin' | 'elektr';

export interface FuelInfo {
  id: FuelType;
  nameUz: string;
  unit: string;
  defaultPrice: number; // so'm per unit (litr or m3)
}

export const FUEL_TYPES: Record<FuelType, FuelInfo> = {
  dizel: { id: 'dizel', nameUz: 'Dizel (Solyarka)', unit: 'litr', defaultPrice: 13500 },
  metan: { id: 'metan', nameUz: 'Metan gaz', unit: 'm³', defaultPrice: 4200 },
  benzin: { id: 'benzin', nameUz: 'Ai-92 Benzin', unit: 'litr', defaultPrice: 11500 },
  elektr: { id: 'elektr', nameUz: 'Elektr quvvati', unit: 'kVt/s', defaultPrice: 1000 },
};

export interface MachineryLogisticSpec {
  id: string;
  nameUz: string;
  icon: string;
  category: string;
  fuelType: FuelType;
  baseFuelPer100Km: number; // Bo'sh holda 100 km ga yoqilg'i sarfi
  driverTripBase: number; // Haydovchi reys bazasi (chiqish haqi)
  driverPerKmRate: number; // Haydovchi 1 km uchun qo'shimcha haqi
  driverHourlyRate: number; // Haydovchi soatlik stavkasi
  wearTollPerKm: number; // Amortizatsiya va moy sarfi 1 km uchun
  baseRentalHourly?: number; // Texnikaning o'zini soatlik narxi
  averageSpeedKmh: number; // Shahar/shahar atrofi o'rtacha tezligi (km/s)
}

export const MACHINERY_SPECS_DATA: Record<string, MachineryLogisticSpec> = {
  avtokran: {
    id: 'avtokran',
    nameUz: 'Avtokran (16t - 50t)',
    icon: '🏗️',
    category: 'avtokran',
    fuelType: 'dizel',
    baseFuelPer100Km: 38, // 38 litr / 100km
    driverTripBase: 120000, // 120 000 so'm bazaviy reys
    driverPerKmRate: 3000, // 3 000 so'm/km
    driverHourlyRate: 60000, // 60 000 so'm/soat
    wearTollPerKm: 2500,
    baseRentalHourly: 400000,
    averageSpeedKmh: 40,
  },
  manipulyator: {
    id: 'manipulyator',
    nameUz: 'Manipulyator (Bort + Kran)',
    icon: '🚛',
    category: 'manipulyator',
    fuelType: 'dizel',
    baseFuelPer100Km: 30, // 30 litr / 100km
    driverTripBase: 100000,
    driverPerKmRate: 2500,
    driverHourlyRate: 50000,
    wearTollPerKm: 2000,
    baseRentalHourly: 350000,
    averageSpeedKmh: 45,
  },
  avtolift: {
    id: 'avtolift',
    nameUz: 'Avtolift (Fasad lifti / Pod’yomnik)',
    icon: '🛗',
    category: 'avtolift',
    fuelType: 'dizel',
    baseFuelPer100Km: 24, // 24 litr / 100km
    driverTripBase: 90000,
    driverPerKmRate: 2000,
    driverHourlyRate: 45000,
    wearTollPerKm: 1500,
    baseRentalHourly: 250000,
    averageSpeedKmh: 45,
  },
  musor: {
    id: 'musor',
    nameUz: 'Musor mashina / Chiqindi tashuvchi',
    icon: '🚚',
    category: 'musor',
    fuelType: 'dizel',
    baseFuelPer100Km: 28,
    driverTripBase: 80000,
    driverPerKmRate: 2200,
    driverHourlyRate: 40000,
    wearTollPerKm: 1800,
    baseRentalHourly: 200000,
    averageSpeedKmh: 50,
  },
  samosval: {
    id: 'samosval',
    nameUz: 'Samosval (Qum, shag‘al, tosh)',
    icon: '🚜',
    category: 'samosval',
    fuelType: 'dizel',
    baseFuelPer100Km: 34,
    driverTripBase: 90000,
    driverPerKmRate: 2500,
    driverHourlyRate: 45000,
    wearTollPerKm: 2200,
    baseRentalHourly: 300000,
    averageSpeedKmh: 45,
  },
  bortmashina: {
    id: 'bortmashina',
    nameUz: 'Bortli yuk mashinasi (Isuzu / Gazel)',
    icon: '🚐',
    category: 'bortmashina',
    fuelType: 'metan',
    baseFuelPer100Km: 20, // 20 m3 metan yoki benzin
    driverTripBase: 60000,
    driverPerKmRate: 1500,
    driverHourlyRate: 35000,
    wearTollPerKm: 1200,
    baseRentalHourly: 180000,
    averageSpeedKmh: 55,
  },
  boshqa: {
    id: 'boshqa',
    nameUz: 'Boshqa maxsus texnika / Traktor',
    icon: '🚜',
    category: 'boshqa',
    fuelType: 'dizel',
    baseFuelPer100Km: 26,
    driverTripBase: 80000,
    driverPerKmRate: 2000,
    driverHourlyRate: 40000,
    wearTollPerKm: 1500,
    baseRentalHourly: 220000,
    averageSpeedKmh: 40,
  },
};

export interface CargoLoadType {
  id: string;
  nameUz: string;
  descriptionUz: string;
  fuelFactor: number; // Yoqilg'i koeffitsiyenti (og'irligi va aerodinamikasi)
  driverComplexityFactor: number; // Haydovchi mas'uliyat/qiyinlik koeffitsiyenti
  recommendedSpeedPenaltyKmh: number;
}

export const CARGO_LOAD_TYPES: CargoLoadType[] = [
  {
    id: 'empty',
    nameUz: 'Yuk ortilmagan (Bo‘sh yurish / Qaytish)',
    descriptionUz: 'Mashina bo‘sh holatda harakatlanadi',
    fuelFactor: 1.0,
    driverComplexityFactor: 1.0,
    recommendedSpeedPenaltyKmh: 0,
  },
  {
    id: 'standard',
    nameUz: 'Oddiy qurilish yuki (Asboblar, yengil detallar)',
    descriptionUz: 'Kichik asbob-uskunalar, generatorlar, o‘rtacha og‘irlik',
    fuelFactor: 1.1,
    driverComplexityFactor: 1.05,
    recommendedSpeedPenaltyKmh: 5,
  },
  {
    id: 'heavy',
    nameUz: 'Og‘ir tosh / metall / qum / shag‘al (Maksimal tonnaj)',
    descriptionUz: 'Mashina to‘liq yuklangan, yuqori yuklama ostida',
    fuelFactor: 1.25,
    driverComplexityFactor: 1.2,
    recommendedSpeedPenaltyKmh: 10,
  },
  {
    id: 'concrete',
    nameUz: 'Beton bloklar, plitalar va yirik konstruksiyalar',
    descriptionUz: 'Haddan tashqari og‘ir, ehtiyotkorlik bilan sekin harakatlanish talab qilinadi',
    fuelFactor: 1.2,
    driverComplexityFactor: 1.25,
    recommendedSpeedPenaltyKmh: 12,
  },
  {
    id: 'oversized',
    nameUz: 'Gabaritsiz yuk (Katta hajmli, uzun kran strelalari, karkaslar)',
    descriptionUz: 'Yo‘lda maxsus e’tibor, kuzatuv va ruxsat talab qilinadi',
    fuelFactor: 1.35,
    driverComplexityFactor: 1.4,
    recommendedSpeedPenaltyKmh: 15,
  },
  {
    id: 'waste',
    nameUz: 'Qurilish chiqindisi (Musor, buzilgan g‘isht, tuproq)',
    descriptionUz: 'Poligonga tashish, og‘ir yoki hajmli chiqindilar',
    fuelFactor: 1.18,
    driverComplexityFactor: 1.1,
    recommendedSpeedPenaltyKmh: 8,
  },
  {
    id: 'delicate',
    nameUz: 'Nozik qimmatbaho texnika (Elektronika, optika, nozik uskunalar)',
    descriptionUz: 'Titrash va zarbalarsiz past tezlikda yetkazish',
    fuelFactor: 1.08,
    driverComplexityFactor: 1.3,
    recommendedSpeedPenaltyKmh: 10,
  },
];

export interface CalculationInput {
  machineryType: string;
  distanceKm: number;
  cargoTypeId: string;
  fuelPricePerLiter?: number;
  customFuelConsumptionPer100Km?: number;
  customDriverHourlyRate?: number;
  roundTrip?: boolean;
  workingHours?: number; // Joydagi ishlash soatlari
  includeMachineryRent?: boolean;
  partnerId?: string;
}

export interface CalculationResult {
  distanceKm: number;
  roundTrip: boolean;
  machinerySpec: MachineryLogisticSpec;
  cargoType: CargoLoadType;
  fuelTypeInfo: FuelInfo;
  effectiveFuelPer100Km: number;
  fuelLiters: number;
  fuelPricePerLiter: number;
  fuelCost: number;
  driverFee: number;
  driverBreakdown: {
    tripBase: number;
    distanceFee: number;
    timeFee: number;
    complexitySurcharge: number;
  };
  wearTollCost: number;
  estimatedTransitTimeHours: number;
  machineryCost: number;
  totalCost: number;
  costPerKm: number;
}

/**
 * Logistika transport xarajatlarini to'liq hisoblash
 */
export function calculateLogisticsCost(input: CalculationInput): CalculationResult {
  const spec = MACHINERY_SPECS_DATA[input.machineryType] || MACHINERY_SPECS_DATA.boshqa;
  const cargo = CARGO_LOAD_TYPES.find(c => c.id === input.cargoTypeId) || CARGO_LOAD_TYPES[1];
  const fuelInfo = FUEL_TYPES[spec.fuelType];

  const roundTrip = Boolean(input.roundTrip);
  const distanceKm = Math.max(1, input.distanceKm) * (roundTrip ? 2 : 1);

  // Yoqilg'i narxi (agar kiritilmagan bo'lsa standart narx olinadi)
  const fuelPrice = input.fuelPricePerLiter && input.fuelPricePerLiter > 0
    ? input.fuelPricePerLiter
    : fuelInfo.defaultPrice;

  // 100 km ga yoqilg'i sarfi (yuk koeffitsiyenti hisobga olingan holda)
  const baseFuel = input.customFuelConsumptionPer100Km && input.customFuelConsumptionPer100Km > 0
    ? input.customFuelConsumptionPer100Km
    : spec.baseFuelPer100Km;

  const effectiveFuelPer100Km = baseFuel * cargo.fuelFactor;
  const fuelLiters = (distanceKm / 100) * effectiveFuelPer100Km;
  const fuelCost = Math.round(fuelLiters * fuelPrice);

  // Vaqtni hisoblash (tranzit tezligi yuk turiga qarab pasayishi mumkin)
  const effectiveSpeed = Math.max(20, spec.averageSpeedKmh - cargo.recommendedSpeedPenaltyKmh);
  const transitTimeHours = Math.round((distanceKm / effectiveSpeed) * 10) / 10;
  const onsiteHours = input.workingHours ? Math.max(0, input.workingHours) : 0;
  const totalHours = transitTimeHours + onsiteHours;

  // Haydovchi xizmat haqi
  const driverHourly = input.customDriverHourlyRate && input.customDriverHourlyRate > 0
    ? input.customDriverHourlyRate
    : spec.driverHourlyRate;

  const tripBase = spec.driverTripBase;
  const distanceFee = distanceKm * spec.driverPerKmRate;
  const timeFee = Math.round(totalHours * driverHourly);
  const rawDriverSum = tripBase + distanceFee + timeFee;

  // Murakkablik ustamasi
  const driverWithComplexity = Math.round(rawDriverSum * cargo.driverComplexityFactor);
  const complexitySurcharge = driverWithComplexity - rawDriverSum;
  const driverFee = driverWithComplexity;

  // Texnika amortizatsiyasi va moy sarfi
  const wearTollCost = Math.round(distanceKm * spec.wearTollPerKm);

  // Texnikaning o'zini ijara narxi (agar tanlangan bo'lsa)
  const machineryCost = input.includeMachineryRent && spec.baseRentalHourly
    ? Math.round(Math.max(1, totalHours) * spec.baseRentalHourly)
    : 0;

  const totalCost = fuelCost + driverFee + wearTollCost + machineryCost;
  const costPerKm = Math.round(totalCost / distanceKm);

  return {
    distanceKm,
    roundTrip,
    machinerySpec: spec,
    cargoType: cargo,
    fuelTypeInfo: fuelInfo,
    effectiveFuelPer100Km: Math.round(effectiveFuelPer100Km * 10) / 10,
    fuelLiters: Math.round(fuelLiters * 10) / 10,
    fuelPricePerLiter: fuelPrice,
    fuelCost,
    driverFee,
    driverBreakdown: {
      tripBase,
      distanceFee,
      timeFee,
      complexitySurcharge,
    },
    wearTollCost,
    estimatedTransitTimeHours: transitTimeHours,
    machineryCost,
    totalCost,
    costPerKm,
  };
}
