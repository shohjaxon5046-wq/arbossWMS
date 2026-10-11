import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Truck,
  Fuel,
  UserCheck,
  RotateCcw,
  Clock,
  Compass,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Settings,
  ChevronDown,
  Layers,
  MapPin,
  Coins
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import {
  calculateLogisticsCost,
  MACHINERY_SPECS_DATA,
  CARGO_LOAD_TYPES,
  FUEL_TYPES,
  type CalculationResult,
  type FuelType,
} from '@/lib/logisticsCalculator';
import type { ServicePartner } from '@/types';

interface LogisticsCalculatorModalProps {
  open: boolean;
  onClose: () => void;
  partners?: ServicePartner[];
  onApplyEstimate?: (summary: {
    machineryName: string;
    distanceKm: number;
    cargoTypeName: string;
    totalCost: number;
    fuelCost: number;
    driverFee: number;
  }) => void;
}

export function LogisticsCalculatorModal({
  open,
  onClose,
  partners = [],
  onApplyEstimate,
}: LogisticsCalculatorModalProps) {
  // Asosiy parametrlar
  const [machineryType, setMachineryType] = useState<string>('avtokran');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [distanceKm, setDistanceKm] = useState<number>(35);
  const [cargoTypeId, setCargoTypeId] = useState<string>('standard');
  const [roundTrip, setRoundTrip] = useState<boolean>(true);
  const [workingHours, setWorkingHours] = useState<number>(3);
  const [includeMachineryRent, setIncludeMachineryRent] = useState<boolean>(false);

  // Kengaytirilgan sozlamalar
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [customFuelPrice, setCustomFuelPrice] = useState<string>('');
  const [customFuelConsumption, setCustomFuelConsumption] = useState<string>('');
  const [customDriverRate, setCustomDriverRate] = useState<string>('');

  // Hamkor tanlanganda avtomatik to'ldirish
  const handlePartnerSelect = (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    if (!partnerId) return;

    const partner = partners.find(p => p.id === partnerId);
    if (!partner) return;

    // Kategoriya mos kelishini aniqlash
    if (partner.service_category && MACHINERY_SPECS_DATA[partner.service_category]) {
      setMachineryType(partner.service_category);
    } else if (partner.service_category === 'musor') {
      setMachineryType('musor');
    }

    // Soatlik tarif mavjud bo'lsa
    if (partner.specs?.hourly_rate && Number(partner.specs.hourly_rate) > 0) {
      setCustomDriverRate(String(Math.round(Number(partner.specs.hourly_rate) * 0.25))); // Haydovchi ulushi taxminan 25%
    }
  };

  // Kalkulyatsiya natijasi
  const result: CalculationResult = useMemo(() => {
    return calculateLogisticsCost({
      machineryType,
      distanceKm: Number(distanceKm) || 1,
      cargoTypeId,
      fuelPricePerLiter: customFuelPrice ? Number(customFuelPrice) : undefined,
      customFuelConsumptionPer100Km: customFuelConsumption ? Number(customFuelConsumption) : undefined,
      customDriverHourlyRate: customDriverRate ? Number(customDriverRate) : undefined,
      roundTrip,
      workingHours: Number(workingHours) || 0,
      includeMachineryRent,
      partnerId: selectedPartnerId,
    });
  }, [
    machineryType,
    distanceKm,
    cargoTypeId,
    customFuelPrice,
    customFuelConsumption,
    customDriverRate,
    roundTrip,
    workingHours,
    includeMachineryRent,
    selectedPartnerId,
  ]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md shadow-inner text-white">
              <Calculator className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Logistika va Transport Kalkulyatori</h2>
              <p className="text-xs text-blue-100">
                Masofa va yuk turiga qarab yoqilg‘i sarfi hamda haydovchi xizmat haqini avtomatik hisoblash
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* CHAP PANEL: Parametrlar formasi (7 ustun) */}
            <div className="lg:col-span-7 space-y-5">
              {/* 1. Texnika turini tanlash */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-blue-600" />
                  1. Qurilish texnikasi turi
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.values(MACHINERY_SPECS_DATA).map(spec => {
                    const isSelected = machineryType === spec.id;
                    return (
                      <button
                        key={spec.id}
                        type="button"
                        onClick={() => {
                          setMachineryType(spec.id);
                          setCustomFuelConsumption('');
                          setCustomDriverRate('');
                        }}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-sm dark:bg-blue-950/40 dark:border-blue-500 dark:text-blue-100 font-semibold ring-2 ring-blue-500/20'
                            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300'
                        }`}
                      >
                        <span className="text-2xl mb-1">{spec.icon}</span>
                        <span className="text-xs line-clamp-1">{spec.nameUz.split('(')[0]}</span>
                        <span className="text-[10px] text-slate-500 mt-0.5">
                          {spec.baseFuelPer100Km} L/100km
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Bazadagi hamkorni biriktirish (ixtiyoriy) */}
                {partners.length > 0 && (
                  <div className="mt-2">
                    <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Mavjud hamkor / mashinani tanlash (ixtiyoriy):
                    </label>
                    <select
                      value={selectedPartnerId}
                      onChange={e => handlePartnerSelect(e.target.value)}
                      className="input-field mt-1 text-xs"
                    >
                      <option value="">— Maxsus texnikalar bazasidan tanlanmagan —</option>
                      {partners.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.company_name} ({p.license_plate || p.driver_name || p.service_category})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 2. Masofa va Qatnov (Km) */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Compass className="h-4 w-4 text-blue-600" />
                    2. Masofa va marshrut
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={roundTrip}
                      onChange={e => setRoundTrip(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Borish va qaytish (2x reys)</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs text-slate-500 block mb-1">
                      Bir tomonlama masofa (km):
                    </span>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="2000"
                        value={distanceKm}
                        onChange={e => setDistanceKm(Math.max(1, Number(e.target.value)))}
                        className="input-field font-bold text-base pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                        km
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 block mb-1">
                      Joyida ishlash / kutish vaqti:
                    </span>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="72"
                        value={workingHours}
                        onChange={e => setWorkingHours(Math.max(0, Number(e.target.value)))}
                        className="input-field font-bold text-base pr-14"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                        soat
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tezkor masofa tugmalari */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400 mr-1">Shablon masofalar:</span>
                  {[10, 25, 50, 80, 120, 200].map(kmVal => (
                    <button
                      key={kmVal}
                      type="button"
                      onClick={() => setDistanceKm(kmVal)}
                      className={`px-2 py-0.5 rounded-md text-[11px] border transition ${
                        distanceKm === kmVal
                          ? 'border-blue-500 bg-blue-100/70 text-blue-700 font-bold dark:bg-blue-900/40 dark:text-blue-200'
                          : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {kmVal} km
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Yuk turi va xususiyati */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-blue-600" />
                  3. Yuk turi (Koeffitsiyent va og‘irlik darajasi)
                </label>
                <select
                  value={cargoTypeId}
                  onChange={e => setCargoTypeId(e.target.value)}
                  className="input-field text-sm font-medium"
                >
                  {CARGO_LOAD_TYPES.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nameUz} (Sarfi: +{Math.round((c.fuelFactor - 1) * 100)}%)
                    </option>
                  ))}
                </select>

                <div className="rounded-lg bg-blue-50/60 p-2.5 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40">
                  <p className="font-medium">{result.cargoType.nameUz}</p>
                  <p className="text-[11px] text-blue-600/90 dark:text-blue-400 mt-0.5">
                    {result.cargoType.descriptionUz} • Yoqilg‘i koeffitsiyenti:{' '}
                    <strong>{result.cargoType.fuelFactor}x</strong> • Haydovchi mas’uliyat koeffitsiyenti:{' '}
                    <strong>{result.cargoType.driverComplexityFactor}x</strong>
                  </p>
                </div>
              </div>

              {/* 4. Qo‘shimcha optsiyalar */}
              <div className="flex flex-col gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={includeMachineryRent}
                    onChange={e => setIncludeMachineryRent(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    Texnikaning soatlik ijara narxini ham umumiy hisobga qo‘shish (+
                    {formatCurrency(result.machinerySpec.baseRentalHourly || 0)}/soat)
                  </span>
                </label>

                {/* Kengaytirilgan tarif sozlamalari toggli */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium w-fit mt-1"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>
                    {showAdvanced ? 'Maxsus narxlarni yashirish' : 'Yoqilg‘i narxi va stavkalarni qo‘lda kiritish'}
                  </span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                </button>

                {showAdvanced && (
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-1">
                        Yoqilg‘i narxi ({result.fuelTypeInfo.unit}):
                      </span>
                      <input
                        type="number"
                        placeholder={`${result.fuelTypeInfo.defaultPrice} so'm`}
                        value={customFuelPrice}
                        onChange={e => setCustomFuelPrice(e.target.value)}
                        className="input-field text-xs py-1"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-1">
                        100 km sarfi ({result.fuelTypeInfo.unit}):
                      </span>
                      <input
                        type="number"
                        placeholder={`${result.machinerySpec.baseFuelPer100Km} L`}
                        value={customFuelConsumption}
                        onChange={e => setCustomFuelConsumption(e.target.value)}
                        className="input-field text-xs py-1"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-1">
                        Haydovchi soatlik stavkasi:
                      </span>
                      <input
                        type="number"
                        placeholder={`${result.machinerySpec.driverHourlyRate} so'm`}
                        value={customDriverRate}
                        onChange={e => setCustomDriverRate(e.target.value)}
                        className="input-field text-xs py-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* O‘NG PANEL: Avtomatik hisoblangan xarajatlar va tahlil (5 ustun) */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4 rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100/70 p-5 dark:border-slate-800 dark:from-slate-800/40 dark:to-slate-900/60 shadow-inner">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Avtomatik xarajat hisobi
                  </h3>
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    Jami {result.distanceKm} km {result.roundTrip ? '(Qaytish bilan)' : ''}
                  </span>
                </div>

                {/* 1. Yoqilg'i kartochkasi */}
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 dark:border-amber-900/30 dark:bg-amber-950/20 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-900 dark:text-amber-200">
                    <span className="flex items-center gap-1.5">
                      <Fuel className="h-4 w-4 text-amber-600" />
                      Yoqilg‘i sarfi ({result.fuelTypeInfo.nameUz})
                    </span>
                    <span className="text-sm font-extrabold text-amber-700 dark:text-amber-300">
                      {formatCurrency(result.fuelCost)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-amber-800/80 dark:text-amber-300/80 pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
                    <div>
                      <span>Sarflanadigan miqdor:</span>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {result.fuelLiters} {result.fuelTypeInfo.unit}
                      </p>
                    </div>
                    <div>
                      <span>O‘rtacha ko‘rsatkich:</span>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {result.effectiveFuelPer100Km} {result.fuelTypeInfo.unit} / 100km
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Haydovchi xizmat haqi kartochkasi */}
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3.5 dark:border-emerald-900/30 dark:bg-emerald-950/20 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                    <span className="flex items-center gap-1.5">
                      <UserCheck className="h-4 w-4 text-emerald-600" />
                      Haydovchi xizmat haqi (Avtomatik)
                    </span>
                    <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                      {formatCurrency(result.driverFee)}
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px] text-emerald-800/80 dark:text-emerald-300/80 pt-1 border-t border-emerald-200/60 dark:border-emerald-900/40">
                    <div className="flex justify-between">
                      <span>Bazaviy reys (chiqish):</span>
                      <span className="font-semibold">{formatCurrency(result.driverBreakdown.tripBase)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Masofa bo‘yicha (+km):</span>
                      <span className="font-semibold">{formatCurrency(result.driverBreakdown.distanceFee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Vaqt va ish soatlari:</span>
                      <span className="font-semibold">{formatCurrency(result.driverBreakdown.timeFee)}</span>
                    </div>
                    {result.driverBreakdown.complexitySurcharge > 0 && (
                      <div className="flex justify-between text-amber-700 dark:text-amber-300">
                        <span>Yuk murakkablik ustamasi:</span>
                        <span className="font-semibold">+{formatCurrency(result.driverBreakdown.complexitySurcharge)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Boshqa sarf-xarajatlar */}
                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 pt-3 dark:border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      Taxminiy yo‘l vaqti:
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      ~{result.estimatedTransitTimeHours} soat
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5 text-slate-400" />
                      Amortizatsiya & moy sarfi:
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatCurrency(result.wearTollCost)}
                    </span>
                  </div>
                  {result.machineryCost > 0 && (
                    <div className="flex justify-between items-center text-blue-600 dark:text-blue-400">
                      <span>Texnika ijarasi ({workingHours} soat):</span>
                      <span className="font-bold">{formatCurrency(result.machineryCost)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
                    <span>1 km o‘rtacha tannarxi:</span>
                    <span className="font-mono">{formatCurrency(result.costPerKm)} / km</span>
                  </div>
                </div>
              </div>

              {/* JAMI NARX VA TASDIQLASH */}
              <div className="pt-4 border-t-2 border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs uppercase font-extrabold tracking-wider text-slate-600 dark:text-slate-400">
                    Jami Logistika Xarajati:
                  </span>
                  <div className="text-right">
                    <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                      {formatCurrency(result.totalCost)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onApplyEstimate && (
                    <button
                      type="button"
                      onClick={() => {
                        onApplyEstimate({
                          machineryName: result.machinerySpec.nameUz,
                          distanceKm: result.distanceKm,
                          cargoTypeName: result.cargoType.nameUz,
                          totalCost: result.totalCost,
                          fuelCost: result.fuelCost,
                          driverFee: result.driverFee,
                        });
                        onClose();
                      }}
                      className="btn-primary flex-1 py-2.5 text-xs flex items-center justify-center gap-1.5 shadow-md"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Xarajatni buyurtmaga qo‘shish</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-secondary px-4 py-2.5 text-xs"
                  >
                    Yopish
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
