import { supabase } from '@/lib/supabase';
import type { Order, OrderItem, OrderPayment, OrderStatus } from '@/types';

export interface OrderFilterOptions {
  status?: OrderStatus | 'all';
  searchQuery?: string;
  limit?: number;
}

export class OrderService {
  /**
   * Fetch all orders with optional filtering
   */
  static async getOrders(options: OrderFilterOptions = {}): Promise<{ data: Order[]; error: string | null }> {
    try {
      let query = supabase.from('erp_orders').select('*').order('created_at', { ascending: false });

      if (options.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) return { data: [], error: error.message };

      let list = (data || []) as Order[];

      if (options.searchQuery && options.searchQuery.trim()) {
        const q = options.searchQuery.toLowerCase().trim();
        list = list.filter(o =>
          o.order_number.toLowerCase().includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          o.customer_phone.includes(q)
        );
      }

      return { data: list, error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Buyurtmalarni yuklashda xatolik' };
    }
  }

  /**
   * Get single order by ID
   */
  static async getOrderById(id: string): Promise<{ data: Order | null; error: string | null }> {
    try {
      const { data, error } = await supabase.from('erp_orders').select('*').eq('id', id).maybeSingle();
      if (error) return { data: null, error: error.message };
      return { data: data as Order, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Buyurtma topilmadi' };
    }
  }

  /**
   * Get order items for a specific order
   */
  static async getOrderItems(orderId: string): Promise<OrderItem[]> {
    const { data } = await supabase.from('erp_order_items').select('*').eq('order_id', orderId);
    return (data || []) as OrderItem[];
  }

  /**
   * Get order payments
   */
  static async getOrderPayments(orderId: string): Promise<OrderPayment[]> {
    const { data } = await supabase.from('erp_order_payments').select('*').eq('order_id', orderId);
    return (data || []) as OrderPayment[];
  }

  /**
   * Update order status
   */
  static async setOrderStatus(orderId: string, status: OrderStatus): Promise<boolean> {
    const { error } = await supabase.rpc('erp_set_order_status', {
      p_order_id: orderId,
      p_status: status,
    });
    return !error;
  }

  /**
   * Record payment for an order
   */
  static async addPayment(params: {
    orderId: string;
    amount: number;
    paymentType: string;
    cashRegisterId: string | null;
    notes?: string;
  }): Promise<boolean> {
    const { error } = await supabase.rpc('erp_add_order_payment', {
      p_order_id: params.orderId,
      p_amount: params.amount,
      p_payment_type: params.paymentType,
      p_cash_register_id: params.cashRegisterId,
      p_notes: params.notes || '',
    });
    return !error;
  }
}
