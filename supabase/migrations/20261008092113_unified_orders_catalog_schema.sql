/*
# Unified orders, extended catalog, depreciation, maintenance log, file storage

1. New Tables
- `erp_categories` (id, name unique, created_at): equipment categories managed from the model editor.
- `erp_maintenance_logs` (id, item_id -> erp_product_items, log_date, kind, works, cost, master, created_by, created_at):
  technical inspection / repair history per physical unit.

2. Modified Tables
- `erp_product_models`: model_code, weekly_discount_pct, monthly_discount_pct, depreciation_pct (percent of purchase
  price written off each time a unit returns from rent), consumables (jsonb list).
- `erp_product_items`: depreciation_pct (optional per-unit override), rental_count, rental_days_total, revenue_total,
  depreciation_total (accumulated write-off).
- `erp_customers`: source ('manual' | 'ibox'), external_id (id in external system, for later iBox import).
- `erp_orders`: total_service_amount, discount_amount.
- `erp_order_items`: discount_pct, line_total, depreciation_applied.
- `erp_service_orders`: order_id -> erp_orders (services are now lines of a unified order).

3. Storage
- Bucket `model-images` (public read, 5 MB, images only): catalog photos. Upload/replace/delete by admin, manager, warehouse.
- Bucket `customer-docs` (private, 5 MB, images only): passport photos. Read/upload by sales roles, delete by admin/manager.

4. Security
- RLS enabled on both new tables, 4 separate policies each. Reads for any active staff; writes restricted by role helpers.
- Role helpers `erp_staff_role()`, `erp_can_sell()`, `erp_can_edit_catalog()` (invoker, stable, fixed search_path).

5. Notes
1. All column additions are additive with defaults; no data is removed.
2. A sequence `erp_order_number_seq` provides collision-free order numbers.
*/

CREATE OR REPLACE FUNCTION erp_staff_role() RETURNS text
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT role FROM erp_staff WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION erp_can_sell() RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(erp_staff_role() IN ('admin','manager','seller','cashier'), false);
$$;

CREATE OR REPLACE FUNCTION erp_can_edit_catalog() RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(erp_staff_role() IN ('admin','manager','warehouse'), false);
$$;

CREATE TABLE IF NOT EXISTS erp_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_erp_categories_name UNIQUE (name),
  CONSTRAINT chk_erp_categories_name CHECK (length(btrim(name)) BETWEEN 1 AND 80)
);
ALTER TABLE erp_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read categories" ON erp_categories;
CREATE POLICY "Staff read categories" ON erp_categories FOR SELECT TO authenticated
USING (erp_staff_role() IS NOT NULL);
DROP POLICY IF EXISTS "Catalog editors insert categories" ON erp_categories;
CREATE POLICY "Catalog editors insert categories" ON erp_categories FOR INSERT TO authenticated
WITH CHECK (erp_can_edit_catalog());
DROP POLICY IF EXISTS "Catalog editors update categories" ON erp_categories;
CREATE POLICY "Catalog editors update categories" ON erp_categories FOR UPDATE TO authenticated
USING (erp_can_edit_catalog()) WITH CHECK (erp_can_edit_catalog());
DROP POLICY IF EXISTS "Catalog editors delete categories" ON erp_categories;
CREATE POLICY "Catalog editors delete categories" ON erp_categories FOR DELETE TO authenticated
USING (erp_can_edit_catalog());

INSERT INTO erp_categories (name)
SELECT DISTINCT btrim(category) FROM erp_product_models WHERE btrim(COALESCE(category,'')) <> ''
ON CONFLICT (name) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_product_models' AND column_name='model_code') THEN
    ALTER TABLE erp_product_models ADD COLUMN model_code text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_product_models' AND column_name='weekly_discount_pct') THEN
    ALTER TABLE erp_product_models ADD COLUMN weekly_discount_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (weekly_discount_pct BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_product_models' AND column_name='monthly_discount_pct') THEN
    ALTER TABLE erp_product_models ADD COLUMN monthly_discount_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (monthly_discount_pct BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_product_models' AND column_name='depreciation_pct') THEN
    ALTER TABLE erp_product_models ADD COLUMN depreciation_pct numeric(5,2) NOT NULL DEFAULT 2 CHECK (depreciation_pct BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_product_models' AND column_name='consumables') THEN
    ALTER TABLE erp_product_models ADD COLUMN consumables jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_product_items' AND column_name='depreciation_pct') THEN
    ALTER TABLE erp_product_items ADD COLUMN depreciation_pct numeric(5,2) CHECK (depreciation_pct IS NULL OR depreciation_pct BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_product_items' AND column_name='rental_count') THEN
    ALTER TABLE erp_product_items ADD COLUMN rental_count integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_product_items' AND column_name='rental_days_total') THEN
    ALTER TABLE erp_product_items ADD COLUMN rental_days_total integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_product_items' AND column_name='revenue_total') THEN
    ALTER TABLE erp_product_items ADD COLUMN revenue_total numeric NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_product_items' AND column_name='depreciation_total') THEN
    ALTER TABLE erp_product_items ADD COLUMN depreciation_total numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_customers' AND column_name='source') THEN
    ALTER TABLE erp_customers ADD COLUMN source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ibox'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_customers' AND column_name='external_id') THEN
    ALTER TABLE erp_customers ADD COLUMN external_id text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_orders' AND column_name='total_service_amount') THEN
    ALTER TABLE erp_orders ADD COLUMN total_service_amount numeric NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_orders' AND column_name='discount_amount') THEN
    ALTER TABLE erp_orders ADD COLUMN discount_amount numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_order_items' AND column_name='discount_pct') THEN
    ALTER TABLE erp_order_items ADD COLUMN discount_pct numeric(5,2) NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_order_items' AND column_name='line_total') THEN
    ALTER TABLE erp_order_items ADD COLUMN line_total numeric NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_order_items' AND column_name='depreciation_applied') THEN
    ALTER TABLE erp_order_items ADD COLUMN depreciation_applied numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_service_orders' AND column_name='order_id') THEN
    ALTER TABLE erp_service_orders ADD COLUMN order_id uuid REFERENCES erp_orders(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_erp_service_orders_order ON erp_service_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_erp_customers_phone ON erp_customers(phone_primary);
CREATE INDEX IF NOT EXISTS idx_erp_order_items_order ON erp_order_items(order_id);

CREATE SEQUENCE IF NOT EXISTS erp_order_number_seq;

CREATE TABLE IF NOT EXISTS erp_maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES erp_product_items(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT current_date,
  kind text NOT NULL DEFAULT 'inspection' CHECK (kind IN ('inspection','repair','replacement')),
  works text NOT NULL DEFAULT '' CHECK (length(works) <= 2000),
  cost numeric NOT NULL DEFAULT 0 CHECK (cost >= 0),
  master text NOT NULL DEFAULT '' CHECK (length(master) <= 120),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_erp_maintenance_item ON erp_maintenance_logs(item_id, log_date DESC);
ALTER TABLE erp_maintenance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read maintenance" ON erp_maintenance_logs;
CREATE POLICY "Staff read maintenance" ON erp_maintenance_logs FOR SELECT TO authenticated
USING (erp_staff_role() IS NOT NULL);
DROP POLICY IF EXISTS "Catalog editors insert maintenance" ON erp_maintenance_logs;
CREATE POLICY "Catalog editors insert maintenance" ON erp_maintenance_logs FOR INSERT TO authenticated
WITH CHECK (erp_can_edit_catalog());
DROP POLICY IF EXISTS "Catalog editors update maintenance" ON erp_maintenance_logs;
CREATE POLICY "Catalog editors update maintenance" ON erp_maintenance_logs FOR UPDATE TO authenticated
USING (erp_can_edit_catalog()) WITH CHECK (erp_can_edit_catalog());
DROP POLICY IF EXISTS "Catalog editors delete maintenance" ON erp_maintenance_logs;
CREATE POLICY "Catalog editors delete maintenance" ON erp_maintenance_logs FOR DELETE TO authenticated
USING (erp_can_edit_catalog());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('model-images', 'model-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
       ('customer-docs', 'customer-docs', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Model images read" ON storage.objects;
CREATE POLICY "Model images read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'model-images');
DROP POLICY IF EXISTS "Model images insert" ON storage.objects;
CREATE POLICY "Model images insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'model-images' AND erp_can_edit_catalog());
DROP POLICY IF EXISTS "Model images update" ON storage.objects;
CREATE POLICY "Model images update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'model-images' AND erp_can_edit_catalog())
WITH CHECK (bucket_id = 'model-images' AND erp_can_edit_catalog());
DROP POLICY IF EXISTS "Model images delete" ON storage.objects;
CREATE POLICY "Model images delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'model-images' AND erp_can_edit_catalog());

DROP POLICY IF EXISTS "Customer docs read" ON storage.objects;
CREATE POLICY "Customer docs read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'customer-docs' AND erp_can_sell());
DROP POLICY IF EXISTS "Customer docs insert" ON storage.objects;
CREATE POLICY "Customer docs insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'customer-docs' AND erp_can_sell());
DROP POLICY IF EXISTS "Customer docs delete" ON storage.objects;
CREATE POLICY "Customer docs delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'customer-docs' AND erp_staff_role() IN ('admin','manager'));
