import { describe, it, expect, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';

describe('Inbound Receiving, Putaway, and Order Lifecycle Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('completes the full Inbound workflow: PO -> Receiving -> Putaway to Shelf', async () => {
    // 1. Create a model and supplier
    const { data: supplier } = await supabase
      .from('erp_suppliers')
      .insert({ name: 'Bosch Asia Official', phone: '+998712000000' })
      .select()
      .single();

    const { data: model } = await supabase
      .from('erp_product_models')
      .insert({ name: 'Makita DHR202 Drill', daily_price: 90000 })
      .select()
      .single();

    // 2. Create Purchase Order
    const { data: po } = await supabase
      .from('erp_purchase_orders')
      .insert({
        po_number: 'PO-TEST-001',
        supplier_id: supplier.id,
        status: 'yangi',
        total_amount: 1800000,
      })
      .select()
      .single();

    // 3. Receive items via RPC erp_receive_purchase
    const receiveRes = await supabase.rpc('erp_receive_purchase', {
      p_po_id: po.id,
      p_lines: [
        { model_id: model.id, good: 2, defective: 0, unit_price: 900000 },
      ],
    });

    expect(receiveRes.error).toBeNull();

    // Verify items were created with status 'joylashtirish_kutilmoqda'
    const { data: itemsAwaiting } = await supabase
      .from('erp_product_items')
      .select('*')
      .eq('purchase_order_id', po.id);

    expect(itemsAwaiting).toBeDefined();
    expect(itemsAwaiting.length).toBe(2);
    expect(itemsAwaiting[0].status).toBe('joylashtirish_kutilmoqda');

    // 4. Create a shelf location
    const { data: shelf } = await supabase
      .from('erp_warehouse_locations')
      .insert({ code: 'A-01-1', sector: 'A', rack: '01', shelf: '1', is_active: true })
      .select()
      .single();

    // 5. Putaway items to shelf via RPC erp_putaway_batch
    const putawayRes = await supabase.rpc('erp_putaway_batch', {
      p_entries: [
        { item_id: itemsAwaiting[0].id, location_id: shelf.id, serial: 'SN-MAK-001' },
        { item_id: itemsAwaiting[1].id, location_id: shelf.id, serial: 'SN-MAK-002' },
      ],
    });

    expect(putawayRes.error).toBeNull();

    // 6. Verify items are now available in warehouse
    const { data: availableItems } = await supabase
      .from('erp_product_items')
      .select('*')
      .eq('warehouse_location_id', shelf.id);

    expect(availableItems).toBeDefined();
    expect(availableItems.length).toBe(2);
    expect(availableItems[0].status).toBe('omborda_bosh');
    expect(availableItems[0].serial_number).toBe('SN-MAK-001');
  });

  it('completes the full Rental Order lifecycle: Rent -> Payment -> Return Completion', async () => {
    // 1. Setup customer, register, and item
    const { data: customer } = await supabase
      .from('erp_customers')
      .insert({ full_name: 'Davron Karimov', phone_primary: '+998909998877', debt: 0 })
      .select()
      .single();

    const { data: register } = await supabase
      .from('erp_cash_registers')
      .insert({ name: 'Asosiy Kassa', current_balance: 5000000, is_active: true })
      .select()
      .single();

    const { data: item } = await supabase
      .from('erp_product_items')
      .insert({
        serial_number: 'SN-RENT-999',
        status: 'omborda_bosh',
      })
      .select()
      .single();

    // 2. Create order
    const totalRent = 240000;
    const depositAmt = 300000;
    const initialPaid = 200000;
    const { data: order } = await supabase
      .from('erp_orders')
      .insert({
        order_number: 'ORD-INT-7701',
        customer_id: customer.id,
        customer_name: customer.full_name,
        status: 'faol_ijarada',
        total_rent_amount: totalRent,
        total_deposit_amount: depositAmt,
        paid_amount: initialPaid,
        debt_amount: totalRent + depositAmt - initialPaid,
      })
      .select()
      .single();

    // Mark item as rented
    await supabase.from('erp_product_items').update({
      status: 'ijarada',
      current_order_id: order.id,
    }).eq('id', item.id);

    // 3. Add order payment via RPC erp_add_order_payment
    const payRes = await supabase.rpc('erp_add_order_payment', {
      p_order_id: order.id,
      p_amount: 340000,
      p_payment_type: 'naqd',
      p_cash_register_id: register.id,
      p_notes: 'Qolgan qarz toliq yopildi',
    });

    expect(payRes.error).toBeNull();

    // Verify order debt is now 0
    const { data: updatedOrder } = await supabase
      .from('erp_orders')
      .select('*')
      .eq('id', order.id)
      .single();

    expect(Number(updatedOrder.debt_amount)).toBe(0);

    // Verify cash register balance increased
    const { data: updatedReg } = await supabase
      .from('erp_cash_registers')
      .select('*')
      .eq('id', register.id)
      .single();

    expect(Number(updatedReg.current_balance)).toBe(5000000 + 340000);

    // 4. Return equipment and complete order via RPC erp_set_order_status
    const completeRes = await supabase.rpc('erp_set_order_status', {
      p_order_id: order.id,
      p_status: 'yakunlandi',
    });

    expect(completeRes.error).toBeNull();

    // Verify item is returned to warehouse
    const { data: releasedItem } = await supabase
      .from('erp_product_items')
      .select('*')
      .eq('id', item.id)
      .single();

    expect(releasedItem.status).toBe('omborda_bosh');
    expect(releasedItem.current_order_id).toBeNull();
  });
});
