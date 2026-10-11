import { describe, it, expect, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import { generateCashReceipt80mmHtml, getCashReceiptPlainText } from '@/lib/receipt';
import { loadOrderBundle } from '@/lib/orders';

describe('End-to-End User Scenarios & Critical Path Validation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Scenario 1: Customer Rental Order -> Receipt Generation -> Debt Management', async () => {
    // 1. Customer registration
    const { data: customer } = await supabase
      .from('erp_customers')
      .insert({
        full_name: 'Shuxrat Ganiyev',
        phone_primary: '+998931112233',
        passport_series: 'AA',
        passport_number: '1234567',
        status: 'aktiv',
        debt: 0,
      })
      .select()
      .single();

    // 2. Equipment model setup
    const { data: model } = await supabase
      .from('erp_product_models')
      .insert({
        name: 'Vibroplita Masalta MS90',
        daily_price: 150000,
        deposit_amount: 500000,
      })
      .select()
      .single();

    const { data: item } = await supabase
      .from('erp_product_items')
      .insert({
        model_id: model.id,
        serial_number: 'MS90-001',
        status: 'omborda_bosh',
      })
      .select()
      .single();

    // 3. User creates 4-day rental order
    const rentDays = 4;
    const totalRent = model.daily_price * rentDays;
    const deposit = model.deposit_amount;
    const paid = 300000;
    const debt = (totalRent + deposit) - paid;

    const { data: order } = await supabase
      .from('erp_orders')
      .insert({
        order_number: 'ORD-E2E-1001',
        customer_id: customer.id,
        customer_name: customer.full_name,
        customer_phone: customer.phone_primary,
        status: 'faol_ijarada',
        start_date: new Date().toISOString(),
        expected_return_date: new Date(Date.now() + rentDays * 86400000).toISOString(),
        total_rent_amount: totalRent,
        total_deposit_amount: deposit,
        paid_amount: paid,
        debt_amount: debt,
        created_by: 'Jasur Sotuvchi',
      })
      .select()
      .single();

    // Link items
    await supabase.from('erp_order_items').insert({
      order_id: order.id,
      product_item_id: item.id,
      model_id: model.id,
      model_name: model.name,
      serial_number: item.serial_number,
      rent_days: rentDays,
      daily_price: model.daily_price,
      deposit_amount: deposit,
      line_total: totalRent,
    });

    // 4. Load full order bundle for receipt rendering
    const bundle = await loadOrderBundle(order.id);
    expect(bundle).toBeDefined();
    expect(bundle.order.id).toBe(order.id);
    expect(bundle.items.length).toBe(1);

    // 5. Generate 80mm cash receipt HTML & plain text
    const receiptHtml = await generateCashReceipt80mmHtml(bundle);
    const receiptText = getCashReceiptPlainText(bundle);

    expect(receiptHtml).toContain('ORD-E2E-1001');
    expect(receiptHtml).toContain('Vibroplita Masalta MS90');
    expect(receiptHtml).toContain('Shuxrat Ganiyev');
    expect(receiptText).toContain('ARBOSS');
    expect(receiptText).toContain('ORD-E2E-1001');
  });

  it('Scenario 2: Cashier Daily Register and Expense Management', async () => {
    // 1. Create register
    const { data: reg } = await supabase
      .from('erp_cash_registers')
      .insert({
        name: 'Filial 1 Kassa',
        currency: 'UZS',
        current_balance: 10000000,
        is_active: true,
      })
      .select()
      .single();

    // 2. Add an expense (e.g., fuel / benzin)
    const expenseAmt = 250000;
    const { data: exp } = await supabase
      .from('erp_expenses')
      .insert({
        title: 'Generatordan benzin harajati',
        amount: expenseAmt,
        category: 'yoqilgi',
        cash_register_id: reg.id,
        date: new Date().toISOString(),
      })
      .select()
      .single();

    expect(exp).toBeDefined();

    // 3. Deduct expense from register
    const newBal = Number(reg.current_balance) - expenseAmt;
    await supabase
      .from('erp_cash_registers')
      .update({ current_balance: newBal })
      .eq('id', reg.id);

    // 4. Verify balance
    const { data: updatedReg } = await supabase
      .from('erp_cash_registers')
      .select('*')
      .eq('id', reg.id)
      .single();

    expect(Number(updatedReg.current_balance)).toBe(9750000);
  });
});
