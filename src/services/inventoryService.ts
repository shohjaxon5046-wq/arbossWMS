import { supabase } from '@/lib/supabase';
import type { ProductModel, ProductItem, WarehouseLocation, Category, ProductItemStatus } from '@/types';

export class InventoryService {
  /**
   * Fetch all product models with their unit statistics
   */
  static async getModelsWithStats(): Promise<{
    models: (ProductModel & { total_units: number; available_units: number })[];
    categories: Category[];
    error: string | null;
  }> {
    try {
      const [modelsRes, itemsRes, catRes] = await Promise.all([
        supabase.from('erp_product_models').select('*').order('created_at', { ascending: false }),
        supabase.from('erp_product_items').select('model_id, status'),
        supabase.from('erp_categories').select('*').order('name'),
      ]);

      const counts = new Map<string, { total: number; free: number }>();
      for (const i of (itemsRes.data ?? []) as { model_id: string; status: ProductItemStatus }[]) {
        const c = counts.get(i.model_id) ?? { total: 0, free: 0 };
        c.total += 1;
        if (i.status === 'omborda_bosh') c.free += 1;
        counts.set(i.model_id, c);
      }

      const models = ((modelsRes.data ?? []) as ProductModel[]).map(m => ({
        ...m,
        total_units: counts.get(m.id)?.total ?? 0,
        available_units: counts.get(m.id)?.free ?? 0,
      }));

      return {
        models,
        categories: (catRes.data ?? []) as Category[],
        error: null,
      };
    } catch (err: any) {
      return { models: [], categories: [], error: err?.message || 'Katalog ma\'lumotlarini yuklashda xatolik' };
    }
  }

  /**
   * Fetch warehouse locations
   */
  static async getLocations(): Promise<WarehouseLocation[]> {
    const { data } = await supabase.from('erp_warehouse_locations').select('*').order('code');
    return (data || []) as WarehouseLocation[];
  }

  /**
   * Batch putaway items to locations
   */
  static async putawayBatch(entries: Array<{ product_item_id: string; warehouse_location_id: string; shelf_code: string }>): Promise<boolean> {
    const { error } = await supabase.rpc('erp_putaway_batch', { p_entries: entries });
    return !error;
  }
}
