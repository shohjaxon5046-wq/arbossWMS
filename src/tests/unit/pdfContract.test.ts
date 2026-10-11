import { describe, it, expect } from 'vitest';
import { buildDraftBundle, type DraftContractParams } from '@/lib/pdfContract';
import type { Customer, ProductItem, ProductModel } from '@/types';

describe('PDF Contract Builder and Generator', () => {
  const mockCustomer = {
    id: 'cust-123',
    full_name: 'Alisher Qodirov',
    phone_primary: '+998901234567',
    phone_secondary: '',
    balance: 0,
    debt: 0,
    status: 'faol',
    passport_series: 'AA',
    passport_number: '1234567',
    passport_photo_url: '',
    address: 'Toshkent sh., Chilonzor 9',
    notes: '',
    rating: 5,
    total_orders: 1,
    total_spent: 100000,
    source: 'manual' as const,
    external_id: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  } as unknown as Customer;

  const mockModel = {
    id: 'mod-1',
    name: 'Bosch GBH 2-26 Perforator',
    model_code: 'BSH-GBH-226',
    brand: 'Bosch',
    category: 'Perforator',
    description: '',
    daily_price: 60000,
    deposit_amount: 300000,
    weekly_discount_pct: 10,
    monthly_discount_pct: 20,
    image_url: '',
    is_active: true,
    total_quantity: 2,
    available_quantity: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  } as unknown as ProductModel;

  const mockItem = {
    id: 'item-101',
    model_id: 'mod-1',
    serial_number: 'BSH-7749',
    barcode: 'BAR-101',
    warehouse_location_id: null,
    warehouse_location_shelf: 'A-1',
    current_order_id: null,
    status: 'omborda_bosh' as const,
    condition: 'yaxshi',
    purchase_price: 1000000,
    depreciation_total: 0,
    purchase_date: null,
    notes: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  } as unknown as ProductItem;

  it('builds a valid draft order bundle from draft modal state', () => {
    const params: DraftContractParams = {
      customer: mockCustomer,
      itemIds: ['item-101'],
      models: [mockModel],
      available: [mockItem],
      days: 3,
      delivery: 'pickup',
      address: '',
      notes: 'Sinov shartnomasi',
      payAmount: 100000,
      payType: 'naqd',
      staffName: 'Admin Shohjaxon'
    };

    const bundle = buildDraftBundle(params);

    expect(bundle.order.customer_name).toBe('Alisher Qodirov');
    expect(bundle.order.customer_phone).toBe('+998901234567');
    expect(bundle.passport).toBe('AA 1234567');
    expect(bundle.items.length).toBe(1);
    expect(bundle.items[0].model_name).toBe('Bosch GBH 2-26 Perforator');
    expect(bundle.items[0].serial_number).toBe('BSH-7749');
    expect(bundle.items[0].rent_days).toBe(3);
    expect(bundle.items[0].daily_price).toBe(60000);
    expect(bundle.items[0].line_total).toBe(180000);
    expect(bundle.order.total_rent_amount).toBe(180000);
    expect(bundle.order.total_deposit_amount).toBe(300000);
    expect(bundle.order.paid_amount).toBe(100000);
    expect(bundle.order.debt_amount).toBe(80000);
    expect(bundle.order.created_by).toBe('Admin Shohjaxon');
  });
});
