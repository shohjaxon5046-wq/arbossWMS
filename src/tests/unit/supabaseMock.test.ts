import { describe, it, expect, beforeEach } from 'vitest';
import { supabase, resetDatabaseToDefaults } from '@/lib/supabase';

describe('Supabase Mock Engine & QueryBuilder Chaining', () => {
  beforeEach(() => {
    // Clean state before tests
    localStorage.clear();
  });

  it('handles insert with .select().maybeSingle() without type error', async () => {
    const payload = {
      name: 'Test Perforator X1',
      daily_price: 90000,
      deposit_amount: 300000,
    };

    const { data, error } = await supabase
      .from('erp_product_models')
      .insert(payload)
      .select()
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.name).toBe('Test Perforator X1');
    expect(data.id).toBeDefined();
  });

  it('handles update with .eq().select().maybeSingle()', async () => {
    const { data: inserted } = await supabase
      .from('erp_product_models')
      .insert({ name: 'Old Model', daily_price: 50000 })
      .select()
      .single();

    const { data: updated, error } = await supabase
      .from('erp_product_models')
      .update({ daily_price: 75000 })
      .eq('id', inserted.id)
      .select()
      .maybeSingle();

    expect(error).toBeNull();
    expect(updated).toBeDefined();
    expect(updated.id).toBe(inserted.id);
    expect(updated.daily_price).toBe(75000);
  });

  it('handles delete with .eq()', async () => {
    const { data: inserted } = await supabase
      .from('erp_product_models')
      .insert({ name: 'To Be Deleted', daily_price: 10000 })
      .select()
      .single();

    const { error: delError } = await supabase
      .from('erp_product_models')
      .delete()
      .eq('id', inserted.id);

    expect(delError).toBeNull();

    const { data: found } = await supabase
      .from('erp_product_models')
      .select('*')
      .eq('id', inserted.id)
      .maybeSingle();

    expect(found).toBeNull();
  });

  it('supports .or() complex search clauses', async () => {
    await supabase.from('erp_customers').insert([
      { full_name: 'Anvar Rustamov', phone_primary: '+998901234567' },
      { full_name: 'Bobur Aliyev', phone_primary: '+998912345678' },
    ]);

    const { data: res } = await supabase
      .from('erp_customers')
      .select('*')
      .or('full_name.ilike.%anvar%,phone_primary.ilike.%91234%');

    expect(res).toBeDefined();
    expect(res.length).toBeGreaterThanOrEqual(2);
  });

  it('automatically resolves relations on erp_purchase_orders with lines', async () => {
    const { data: orders } = await supabase
      .from('erp_purchase_orders')
      .select('*, erp_purchase_order_lines(*)');

    expect(orders).toBeDefined();
    expect(Array.isArray(orders)).toBe(true);
    for (const po of orders) {
      expect(Array.isArray(po.erp_purchase_order_lines)).toBe(true);
    }
  });

  it('automatically joins models into erp_product_items', async () => {
    const { data: items } = await supabase
      .from('erp_product_items')
      .select('*');

    expect(items).toBeDefined();
    expect(items.length).toBeGreaterThan(0);
    const withModel = items.find((i: any) => i.model_id);
    if (withModel) {
      expect(withModel.erp_product_models).toBeDefined();
      expect(withModel.erp_product_models.name).toBeDefined();
    }
  });
});
