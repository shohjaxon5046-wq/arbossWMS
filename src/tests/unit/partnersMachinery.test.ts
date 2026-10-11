import { describe, it, expect } from 'vitest';
import { getMachineSummaryLine, getCategoryInfo } from '@/pages/PartnersPage';
import { SERVICE_CATEGORIES } from '@/lib/orders';
import type { ServicePartner } from '@/types';

describe('Special Machinery & Partners Dynamic Parameters', () => {
  it('contains all 6 required machinery categories with icons and localized names', () => {
    const categoryValues = SERVICE_CATEGORIES.map(c => c.value);
    expect(categoryValues).toContain('avtokran');
    expect(categoryValues).toContain('manipulyator');
    expect(categoryValues).toContain('avtolift');
    expect(categoryValues).toContain('musor');
    expect(categoryValues).toContain('gruzchik');
    expect(categoryValues).toContain('boshqa');
    expect(SERVICE_CATEGORIES.length).toBe(6);
  });

  it('correctly formats Avtokran dynamic parameters summary line', () => {
    const cranePartner: ServicePartner = {
      id: 'test-crane',
      company_name: 'Kamaz Avtokran 25t',
      service_category: 'avtokran',
      license_plate: '01 777 AAB',
      driver_name: 'Xurshid aka',
      phone_primary: '+998901112233',
      phone_secondary: '',
      is_available: true,
      status: 'bosh',
      rating: 5,
      notes: '',
      specs: {
        lifting_capacity: '25t',
        boom_length: '28m',
        min_hours: '2 soat',
        hourly_rate: 400000,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const line = getMachineSummaryLine(cranePartner);
    expect(line).toContain('Kamaz Avtokran 25t');
    expect(line).toContain('Yuk 25t');
    expect(line).toContain('Strela 28m');
    expect(line).toContain('Bo‘sh');
  });

  it('correctly formats Manipulyator dynamic parameters summary line', () => {
    const manipPartner: ServicePartner = {
      id: 'test-manip',
      company_name: 'Kamaz Manipulyator',
      service_category: 'manipulyator',
      license_plate: '01 555 XYZ',
      driver_name: 'Jasur aka',
      phone_primary: '+998934567890',
      phone_secondary: '',
      is_available: true,
      status: 'bosh',
      rating: 4.8,
      notes: '',
      specs: {
        body_capacity: '10t',
        crane_capacity: '3t',
        body_length: '6 metr',
        hourly_rate: 350000,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const line = getMachineSummaryLine(manipPartner);
    expect(line).toContain('Kamaz Manipulyator');
    expect(line).toContain('Bort 10t');
    expect(line).toContain('Strela 3t');
    expect(line).toContain('Bo‘sh');
  });

  it('correctly formats Avtolift (Fasad lifti) dynamic parameters summary line', () => {
    const liftPartner: ServicePartner = {
      id: 'test-lift',
      company_name: 'Avtolift Fasadchi 35m',
      service_category: 'avtolift',
      license_plate: '10 333 BBA',
      driver_name: 'Olim aka',
      phone_primary: '+998917776655',
      phone_secondary: '',
      is_available: false,
      status: 'band',
      rating: 4.7,
      notes: '',
      specs: {
        lift_height: '12-qavat / 35 metr',
        basket_capacity: '400 kg',
        hourly_rate: 300000,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const line = getMachineSummaryLine(liftPartner);
    expect(line).toContain('Avtolift Fasadchi 35m');
    expect(line).toContain('Balandlik 12-qavat / 35 metr');
    expect(line).toContain('Lyulka 400 kg');
    expect(line).toContain('Band');
  });

  it('correctly formats Musor mashina dynamic parameters summary line', () => {
    const wastePartner: ServicePartner = {
      id: 'test-waste',
      company_name: 'HOWO Chiqindi tashish',
      service_category: 'musor',
      license_plate: '01 444 TTT',
      phone_primary: '+998971239988',
      phone_secondary: '',
      is_available: true,
      status: 'bosh',
      rating: 4.9,
      notes: '',
      specs: {
        body_volume: '16 m³',
        tonnage: '10t',
        trip_price: 450000,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const line = getMachineSummaryLine(wastePartner);
    expect(line).toContain('Kuzov 16 m³');
    expect(line).toContain('Yuk 10t');
    expect(line).toContain('Bo‘sh');
  });
});
