/*
# Logistika kalkulyatori: buyurtmalar, narx jadvallari va RLS

1. New Tables
- `cargo_items` (id, name, weight_kg, price, unit, active, sort) — gruzchik xizmatida tashiladigan yuklar (sement qop, gipsokarton, reyka...).
- `floor_pricing` (id, from_floor, to_floor, surcharge_per_item, surcharge_per_worker) — etajga qarab har yuk va har ishchiga qo'shiladigan ustama.
- `lift_types` (id, name, capacity_multiplier, price_multiplier, active) — lift turi: yo'q, yo'lovchi, yuk.
- `loader_settings` (key, value) — worker_capacity_kg, hourly_rate, free_distance_m, price_per_10m, min_order.
- `equipment` (id, name, hourly_rate, capacity_kg, max_height_m, min_hours, active) — kran/texnika.
- `equipment_settings` (key, value) — km_price, mobilization_fee.
- `waste_vehicles` (id, name, capacity_m3, capacity_ton, base_price, km_price, active) — musir mashinalari.
- `waste_types` (id, name, density_ton_m3, price_multiplier, active) — musir turlari (qurilish, maishiy, daraxt-shox).
- `waste_settings` (key, value) — loader_fee va boshqa parametrlar.
- `logistics_orders` (id, order_number, service, customer_name, customer_phone, address, datetime, note, details jsonb,
  estimated_price, status, created_by, seller_name, created_at, updated_at, updated_by) — kalkulyator buyurtmalari.
- `logistics_order_history` (id, order_id, changed_by, old_status, new_status, changed_at) — har bir holat o'zgarishi qayd etiladi.

2. Security
- `erp_is_admin_or_manager()` yordamchi funksiyasi qo'shiladi.
- RLS barcha jadvallarda yoqiladi, har biriga 4 ta alohida policy.
- Narx jadvallari: faol xodim o'qiy oladi; admin/menejer o'zgartiradi; sotuvchi o'zgartira olmaydi.
- logistics_orders: sotuvchi o'z buyurtmalarini ochadi va o'qiydi; admin/menejer barchasini o'qiydi, o'zgartiradi, o'chiradi.
- `logistics_set_status(order_id, new_status)` funksiyasi holat o'zgarishini bajaradi va tarixga yozadi (faqat admin/menejer).

3. Seed
- Kiritilgan narxlar tizim darhol ishlashi uchun namuna ma'lumotlar.

4. Notes
- Ma'lumot o'chirilmaydi; jadvallar faqat qo'shiladi.
*/

-- Yordamchi: admin yoki menejer ekanini tekshiradi
CREATE OR REPLACE FUNCTION erp_is_admin_or_manager()
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(erp_staff_role() IN ('admin','manager'), false);
$$;

-- ============ NARX JADVALLARI ============

CREATE TABLE IF NOT EXISTS cargo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  weight_kg numeric NOT NULL DEFAULT 0 CHECK (weight_kg >= 0),
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  unit text NOT NULL DEFAULT 'dona',
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS floor_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_floor integer NOT NULL CHECK (from_floor >= 1),
  to_floor integer NOT NULL CHECK (to_floor >= from_floor),
  surcharge_per_item numeric NOT NULL DEFAULT 0 CHECK (surcharge_per_item >= 0),
  surcharge_per_worker numeric NOT NULL DEFAULT 0 CHECK (surcharge_per_worker >= 0),
  UNIQUE (from_floor, to_floor)
);

CREATE TABLE IF NOT EXISTS lift_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  capacity_multiplier numeric NOT NULL DEFAULT 1 CHECK (capacity_multiplier > 0),
  price_multiplier numeric NOT NULL DEFAULT 1 CHECK (price_multiplier >= 0),
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS loader_settings (
  key text PRIMARY KEY,
  value numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  hourly_rate numeric NOT NULL DEFAULT 0 CHECK (hourly_rate >= 0),
  capacity_kg numeric NOT NULL DEFAULT 0 CHECK (capacity_kg >= 0),
  max_height_m numeric NOT NULL DEFAULT 0 CHECK (max_height_m >= 0),
  min_hours numeric NOT NULL DEFAULT 1 CHECK (min_hours >= 0),
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS equipment_settings (
  key text PRIMARY KEY,
  value numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS waste_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  capacity_m3 numeric NOT NULL DEFAULT 0 CHECK (capacity_m3 >= 0),
  capacity_ton numeric NOT NULL DEFAULT 0 CHECK (capacity_ton >= 0),
  base_price numeric NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  km_price numeric NOT NULL DEFAULT 0 CHECK (km_price >= 0),
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS waste_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  density_ton_m3 numeric NOT NULL DEFAULT 0 CHECK (density_ton_m3 >= 0),
  price_multiplier numeric NOT NULL DEFAULT 1 CHECK (price_multiplier >= 0),
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS waste_settings (
  key text PRIMARY KEY,
  value numeric NOT NULL DEFAULT 0
);

-- Faol xodim o'qiydi, admin/menejer yozadi
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['cargo_items','floor_pricing','lift_types','loader_settings','equipment','equipment_settings','waste_vehicles','waste_types','waste_settings']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "logistics read" ON %I', t);
    EXECUTE format('CREATE POLICY "logistics read" ON %I FOR SELECT TO authenticated USING (erp_staff_role() IS NOT NULL)', t);
    EXECUTE format('DROP POLICY IF EXISTS "logistics insert" ON %I', t);
    EXECUTE format('CREATE POLICY "logistics insert" ON %I FOR INSERT TO authenticated WITH CHECK (erp_is_admin_or_manager())', t);
    EXECUTE format('DROP POLICY IF EXISTS "logistics update" ON %I', t);
    EXECUTE format('CREATE POLICY "logistics update" ON %I FOR UPDATE TO authenticated USING (erp_is_admin_or_manager()) WITH CHECK (erp_is_admin_or_manager())', t);
    EXECUTE format('DROP POLICY IF EXISTS "logistics delete" ON %I', t);
    EXECUTE format('CREATE POLICY "logistics delete" ON %I FOR DELETE TO authenticated USING (erp_is_admin_or_manager())', t);
  END LOOP;
END $$;

-- ============ BUYURTMALAR ============

CREATE SEQUENCE IF NOT EXISTS logistics_order_number_seq;

CREATE TABLE IF NOT EXISTS logistics_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT ('LX-' || lpad(nextval('logistics_order_number_seq')::text, 6, '0')),
  service text NOT NULL CHECK (service IN ('gruzchik','kran','musir')),
  customer_name text NOT NULL CHECK (length(btrim(customer_name)) BETWEEN 1 AND 200),
  customer_phone text NOT NULL CHECK (length(btrim(customer_phone)) BETWEEN 1 AND 30),
  address text NOT NULL DEFAULT '' CHECK (length(address) <= 500),
  datetime timestamptz,
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 1000),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  estimated_price numeric NOT NULL DEFAULT 0 CHECK (estimated_price >= 0),
  status text NOT NULL DEFAULT 'yangi' CHECK (status IN ('yangi','jarayonda','bajarildi','bekor')),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  seller_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE INDEX IF NOT EXISTS idx_logistics_orders_created_by ON logistics_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_logistics_orders_created_at ON logistics_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logistics_orders_status ON logistics_orders(status);
CREATE INDEX IF NOT EXISTS idx_logistics_orders_service ON logistics_orders(service);

CREATE TABLE IF NOT EXISTS logistics_order_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES logistics_orders(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL DEFAULT auth.uid(),
  old_status text NOT NULL,
  new_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logistics_history_order ON logistics_order_history(order_id, changed_at DESC);

ALTER TABLE logistics_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_order_history ENABLE ROW LEVEL SECURITY;

-- Sotuvchi o'z buyurtmasini ochadi va o'qiydi; admin/menejer hammasini ko'radi.
DROP POLICY IF EXISTS "logistics_orders select" ON logistics_orders;
CREATE POLICY "logistics_orders select" ON logistics_orders FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR erp_is_admin_or_manager());

DROP POLICY IF EXISTS "logistics_orders insert" ON logistics_orders;
CREATE POLICY "logistics_orders insert" ON logistics_orders FOR INSERT TO authenticated
  WITH CHECK (erp_can_sell() AND created_by = auth.uid());

DROP POLICY IF EXISTS "logistics_orders update" ON logistics_orders;
CREATE POLICY "logistics_orders update" ON logistics_orders FOR UPDATE TO authenticated
  USING (erp_is_admin_or_manager()) WITH CHECK (erp_is_admin_or_manager());

DROP POLICY IF EXISTS "logistics_orders delete" ON logistics_orders;
CREATE POLICY "logistics_orders delete" ON logistics_orders FOR DELETE TO authenticated
  USING (erp_is_admin_or_manager());

-- Tarixni admin/menejer o'qiydi; sotuvchi ham o'z buyurtmasining tarixini ko'ra oladi.
DROP POLICY IF EXISTS "logistics_history select" ON logistics_order_history;
CREATE POLICY "logistics_history select" ON logistics_order_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM logistics_orders o
      WHERE o.id = logistics_order_history.order_id
        AND (o.created_by = auth.uid() OR erp_is_admin_or_manager())
    )
  );

DROP POLICY IF EXISTS "logistics_history insert" ON logistics_order_history;
CREATE POLICY "logistics_history insert" ON logistics_order_history FOR INSERT TO authenticated
  WITH CHECK (erp_is_admin_or_manager());

-- Holat o'zgarishini bajaradi va tarixga yozadi
CREATE OR REPLACE FUNCTION logistics_set_status(p_order_id uuid, p_new_status text)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_old text;
BEGIN
  IF NOT erp_is_admin_or_manager() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_new_status NOT IN ('yangi','jarayonda','bajarildi','bekor') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  SELECT status INTO v_old FROM logistics_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_old = p_new_status THEN RETURN; END IF;
  UPDATE logistics_orders SET status = p_new_status, updated_at = now(), updated_by = auth.uid() WHERE id = p_order_id;
  INSERT INTO logistics_order_history (order_id, changed_by, old_status, new_status)
  VALUES (p_order_id, auth.uid(), v_old, p_new_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION logistics_set_status(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION logistics_set_status(uuid, text) TO authenticated;

-- ============ SEED (idempotent) ============

INSERT INTO cargo_items (name, weight_kg, price, unit, sort, active) VALUES
  ('Sement qop 10 kg', 10, 500, 'qop', 1, true),
  ('Sement qop 30 kg', 30, 1200, 'qop', 2, true),
  ('Sement qop 50 kg', 50, 1500, 'qop', 3, true),
  ('Gipsokarton', 30, 4000, 'list', 4, true),
  ('Reyka / profil', 5, 3000, 'dona', 5, true),
  ('Penoblok', 18, 3500, 'dona', 6, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO floor_pricing (from_floor, to_floor, surcharge_per_item, surcharge_per_worker) VALUES
  (1, 2, 0, 0),
  (3, 5, 2000, 15000),
  (6, 9, 3000, 20000),
  (10, 15, 4000, 25000),
  (16, 25, 5000, 30000),
  (26, 30, 6000, 35000)
ON CONFLICT (from_floor, to_floor) DO NOTHING;

INSERT INTO lift_types (name, capacity_multiplier, price_multiplier, active) VALUES
  ('Yo''q', 1, 1, true),
  ('Yo''lovchi lifti', 0.9, 1.1, true),
  ('Yuk lifti', 1.5, 1, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO loader_settings (key, value) VALUES
  ('worker_capacity_kg', 50),
  ('hourly_rate', 60000),
  ('free_distance_m', 10),
  ('price_per_10m', 15000),
  ('min_order', 80000)
ON CONFLICT (key) DO NOTHING;

INSERT INTO equipment (name, hourly_rate, capacity_kg, max_height_m, min_hours, active) VALUES
  ('Avtokran 25t', 350000, 25000, 30, 3, true),
  ('Manipulyator 10t', 280000, 10000, 15, 3, true),
  ('Ekskavator', 300000, 8000, 8, 4, true),
  ('Avtovishka 22m', 220000, 300, 22, 3, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO equipment_settings (key, value) VALUES
  ('km_price', 15000),
  ('mobilization_fee', 250000)
ON CONFLICT (key) DO NOTHING;

INSERT INTO waste_vehicles (name, capacity_m3, capacity_ton, base_price, km_price, active) VALUES
  ('Gazel', 5, 1.5, 120000, 5000, true),
  ('Isuzu', 10, 4, 200000, 7000, true),
  ('Kamaz', 20, 10, 350000, 9000, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO waste_types (name, density_ton_m3, price_multiplier, active) VALUES
  ('Qurilish chiqindisi', 0.6, 1, true),
  ('Maishiy chiqindi', 0.3, 0.8, true),
  ('Daraxt-shox', 0.2, 0.7, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO waste_settings (key, value) VALUES
  ('loader_fee', 150000),
  ('floor_surcharge_per_floor', 15000)
ON CONFLICT (key) DO NOTHING;
