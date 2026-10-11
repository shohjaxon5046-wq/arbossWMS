import { supabase } from '@/lib/supabase';
import type { Customer } from '@/types';

export class CrmService {
  /**
   * Get customers with optional query
   */
  static async getCustomers(searchQuery?: string): Promise<{ data: Customer[]; error: string | null }> {
    try {
      let query = supabase.from('erp_customers').select('*').order('created_at', { ascending: false });

      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const { data, error } = await query;
        if (error) return { data: [], error: error.message };

        const filtered = (data || []).filter((c: Customer) =>
          c.full_name.toLowerCase().includes(q) ||
          c.phone_primary.includes(q) ||
          c.phone_secondary.includes(q)
        );
        return { data: filtered, error: null };
      }

      const { data, error } = await query;
      if (error) return { data: [], error: error.message };
      return { data: (data || []) as Customer[], error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Mijozlar ro\'yxatini yuklashda xatolik' };
    }
  }

  /**
   * Save customer (insert or update)
   */
  static async saveCustomer(customer: Partial<Customer>): Promise<{ data: Customer | null; error: string | null }> {
    try {
      if (customer.id) {
        const { error } = await supabase.from('erp_customers').update(customer).eq('id', customer.id);
        if (error) return { data: null, error: error.message };
        return { data: customer as Customer, error: null };
      } else {
        const { data, error } = await supabase.from('erp_customers').insert(customer).select().single();
        if (error) return { data: null, error: error.message };
        return { data: data as Customer, error: null };
      }
    } catch (err: any) {
      return { data: null, error: err?.message || 'Mijoz ma\'lumotini saqlashda xatolik' };
    }
  }
}
