import { describe, it, expect } from 'vitest';
import {
  calculateLogisticsCost,
  MACHINERY_SPECS_DATA,
  CARGO_LOAD_TYPES,
  FUEL_TYPES,
} from '@/lib/logisticsCalculator';

describe('Logistics Calculator Service', () => {
  it('calculates crane transport cost accurately based on distance and load type', () => {
    const result = calculateLogisticsCost({
      machineryType: 'avtokran',
      distanceKm: 50,
      cargoTypeId: 'concrete', // 1.2 fuel multiplier, 1.25 complexity
      fuelPricePerLiter: 13000,
      roundTrip: false,
      workingHours: 2,
    });

    // Distance
    expect(result.distanceKm).toBe(50);

    // Fuel consumption: 38 L / 100km * 1.2 cargo multiplier = 45.6 L / 100km
    // For 50 km = 22.8 liters
    expect(result.fuelLiters).toBeCloseTo(22.8, 1);
    expect(result.fuelCost).toBe(Math.round(22.8 * 13000));

    // Driver fee breakdown:
    // Base trip: 120,000
    // Distance: 50 * 3,000 = 150,000
    // Transit time: 50 km / (40 - 12) km/h = 50 / 28 = 1.8 hrs
    // Total hours: 1.8 + 2 = 3.8 hrs
    // Time fee: round(3.8 * 60,000) = 228,000
    // Raw sum = 120,000 + 150,000 + 228,000 = 498,000
    // With concrete complexity 1.25: round(498,000 * 1.25) = 622,500
    expect(result.driverFee).toBe(622500);

    // Total must equal fuelCost + driverFee + wearTollCost + machineryCost
    expect(result.totalCost).toBe(
      result.fuelCost + result.driverFee + result.wearTollCost + result.machineryCost
    );
  });

  it('doubles distance and fuel for round trip', () => {
    const oneWay = calculateLogisticsCost({
      machineryType: 'samosval',
      distanceKm: 30,
      cargoTypeId: 'heavy',
      roundTrip: false,
    });

    const roundTrip = calculateLogisticsCost({
      machineryType: 'samosval',
      distanceKm: 30,
      cargoTypeId: 'heavy',
      roundTrip: true,
    });

    expect(roundTrip.distanceKm).toBe(60);
    // 34 * 1.25 = 42.5 L / 100km. 30km -> 12.75 L (rounds to 12.8), 60km -> 25.5 L
    expect(roundTrip.fuelLiters).toBeCloseTo(25.5, 1);
    expect(roundTrip.fuelCost).toBe(oneWay.fuelCost * 2);
  });

  it('handles custom machinery overrides', () => {
    const custom = calculateLogisticsCost({
      machineryType: 'boshqa',
      customFuelConsumptionPer100Km: 25,
      customDriverHourlyRate: 50000,
      distanceKm: 100,
      workingHours: 4,
      cargoTypeId: 'empty', // fuelFactor 1.0
    });

    // 25 L/100km * 1.0 * 100km = 25 liters
    expect(custom.fuelLiters).toBe(25);
    expect(custom.driverFee).toBeGreaterThan(200000);
  });

  it('provides all cargo load types and default fuel prices', () => {
    expect(CARGO_LOAD_TYPES.length).toBeGreaterThan(4);
    expect(FUEL_TYPES.dizel.defaultPrice).toBeGreaterThan(10000);
    expect(MACHINERY_SPECS_DATA.manipulyator.fuelType).toBe('dizel');
  });
});
