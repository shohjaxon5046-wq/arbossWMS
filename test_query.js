import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await sb.from('erp_product_models')
    .select(`
      id, 
      name,
      erp_product_items!inner(id)
    `)
    .eq('is_active', true)
    .eq('erp_product_items.status', 'omborda_bosh');
    
  console.log('Error:', error);
  console.log('Data:', JSON.stringify(data, null, 2));
}
run();
