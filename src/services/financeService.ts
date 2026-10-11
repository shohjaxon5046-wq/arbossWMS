import { supabase } from '@/lib/supabase';
import type { CashRegister, Expense, OrderPayment } from '@/types';

export class FinanceService {
  /**
   * Get all cash registers and total current cash balance
   */
  static async getCashOverview(): Promise<{
    registers: CashRegister[];
    totalCash: number;
    error: string | null;
  }> {
    try {
      const { data, error } = await supabase.from('erp_cash_registers').select('*').order('name');
      if (error) return { registers: [], totalCash: 0, error: error.message };

      const registers = (data || []) as CashRegister[];
      const totalCash = registers.reduce((sum, r) => sum + (Number(r.current_balance) || 0), 0);
      return { registers, totalCash, error: null };
    } catch (err: any) {
      return { registers: [], totalCash: 0, error: err?.message || 'Kassa ma\'lumotlarini yuklashda xatolik' };
    }
  }

  /**
   * Add a new business expense
   */
  static async recordExpense(expense: {
    title: string;
    amount: number;
    category: string;
    cash_register_id: string | null;
    date: string;
    notes?: string;
    created_by: string;
  }): Promise<{ data: Expense | null; error: string | null }> {
    try {
      const { data, error } = await supabase.from('erp_expenses').insert({
        ...expense,
        notes: expense.notes || '',
      }).select().single();

      if (error) return { data: null, error: error.message };

      // Deduct from cash register if specified
      if (expense.cash_register_id) {
        const { data: reg } = await supabase
          .from('erp_cash_registers')
          .select('current_balance')
          .eq('id', expense.cash_register_id)
          .single();

        if (reg) {
          const newBal = (Number(reg.current_balance) || 0) - expense.amount;
          await supabase
            .from('erp_cash_registers')
            .update({ current_balance: newBal })
            .eq('id', expense.cash_register_id);
        }
      }

      return { data: data as Expense, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Xarajatni saqlashda xatolik' };
    }
  }
}
