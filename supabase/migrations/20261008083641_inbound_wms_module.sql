/*
# Inbound (Kirim) module: suppliers, purchase orders, receiving, putaway, supplier returns, shelf locations

## Plain-English summary
Replaces the simple "add equipment to warehouse" flow with a full inbound process:
order equipment from a supplier -> receive it against the order (good / defective) ->
put each good unit on a QR-labelled shelf with its serial number -> send defective or
unsuitable units back to the supplier.

## New tables
1. `erp_suppliers` - equipment suppliers (name, contact_person, phone, address, notes).
2. `erp_purchase_orders` - orders to suppliers (po_number unique, supplier_id, status, expected_date, notes, created_by).
   status: yangi | yuborildi | qisman_qabul | qabul_qilindi | bekor
3. `erp_purchase_order_lines` - models and quantities per order (model_id, quantity_ordered, quantity_received, unit_price).
4. `erp_supplier_returns` - returns to suppliers (return_number unique, supplier_id, status, reason, notes, sent_at, closed_at).
   status: yangi | yuborildi | almashtirildi | pul_qaytarildi
5. `erp_supplier_return_items` - which equipment units are in a return.

## Modified tables
- `erp_warehouse_locations` (shelves): new `rack`, `code` (unique, e.g. A-01-03), `capacity`, `is_active`.
- `erp_product_items`: new `supplier_id`, `purchase_order_id`, `defect_reason`.
  New statuses used: joylashtirish_kutilmoqda (awaiting putaway), qaytarish_kutilmoqda (awaiting return),
  qaytarilmoqda (in a return), qaytarildi (returned to supplier).
  Unique serial number when filled in.

## Functions (run with the caller's own permissions, all-or-nothing)
- `erp_can_manage_inbound()` - true if the signed-in staff member is active admin / manager / warehouse.
- `erp_receive_purchase(po_id, lines)` - receive good and defective units against an order.
- `erp_putaway_item(item_id, serial, location_id)` - set serial number and shelf, unit becomes available.
- `erp_create_supplier_return(supplier_id, item_ids, reason, notes)` - create a return.
- `erp_set_return_status(return_id, status)` - send / close a return; "almashtirildi" creates replacement units awaiting putaway.

## Security
- RLS on all new tables. Every signed-in staff member can read (shared company data).
- Only admin / manager / warehouse staff can create, change or delete inbound data and shelves.

## Notes
1. No data is removed; existing tables only gain columns.
2. All functions are idempotent to re-create.
*/

CREATE OR REPLACE FUNCTION erp_can_manage_inbound()
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM erp_staff
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin','manager','warehouse')
  );
$$;

-- Suppliers
CREATE TABLE IF NOT EXISTS erp_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text DEFAULT '',
  phone text DEFAULT '',
  address text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE erp_suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sup_select" ON erp_suppliers;
CREATE POLICY "sup_select" ON erp_suppliers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "sup_insert" ON erp_suppliers;
CREATE POLICY "sup_insert" ON erp_suppliers FOR INSERT TO authenticated WITH CHECK (erp_can_manage_inbound());
DROP POLICY IF EXISTS "sup_update" ON erp_suppliers;
CREATE POLICY "sup_update" ON erp_suppliers FOR UPDATE TO authenticated USING (erp_can_manage_inbound()) WITH CHECK (erp_can_manage_inbound());
DROP POLICY IF EXISTS "sup_delete" ON erp_suppliers;
CREATE POLICY "sup_delete" ON erp_suppliers FOR DELETE TO authenticated USING (erp_can_manage_inbound());

-- Purchase orders
CREATE TABLE IF NOT EXISTS erp_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE NOT NULL,
  supplier_id uuid NOT NULL REFERENCES erp_suppliers(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'yangi' CHECK (status IN ('yangi','yuborildi','qisman_qabul','qabul_qilindi','bekor')),
  expected_date date,
  notes text DEFAULT '',
  created_by text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE erp_purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "po_select" ON erp_purchase_orders;
CREATE POLICY "po_select" ON erp_purchase_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "po_insert" ON erp_purchase_orders;
CREATE POLICY "po_insert" ON erp_purchase_orders FOR INSERT TO authenticated WITH CHECK (erp_can_manage_inbound());
DROP POLICY IF EXISTS "po_update" ON erp_purchase_orders;
CREATE POLICY "po_update" ON erp_purchase_orders FOR UPDATE TO authenticated USING (erp_can_manage_inbound()) WITH CHECK (erp_can_manage_inbound());
DROP POLICY IF EXISTS "po_delete" ON erp_purchase_orders;
CREATE POLICY "po_delete" ON erp_purchase_orders FOR DELETE TO authenticated USING (erp_can_manage_inbound());

CREATE TABLE IF NOT EXISTS erp_purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES erp_purchase_orders(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES erp_product_models(id) ON DELETE RESTRICT,
  quantity_ordered integer NOT NULL CHECK (quantity_ordered > 0),
  quantity_received integer NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  unit_price numeric NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE erp_purchase_order_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pol_select" ON erp_purchase_order_lines;
CREATE POLICY "pol_select" ON erp_purchase_order_lines FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pol_insert" ON erp_purchase_order_lines;
CREATE POLICY "pol_insert" ON erp_purchase_order_lines FOR INSERT TO authenticated WITH CHECK (erp_can_manage_inbound());
DROP POLICY IF EXISTS "pol_update" ON erp_purchase_order_lines;
CREATE POLICY "pol_update" ON erp_purchase_order_lines FOR UPDATE TO authenticated USING (erp_can_manage_inbound()) WITH CHECK (erp_can_manage_inbound());
DROP POLICY IF EXISTS "pol_delete" ON erp_purchase_order_lines;
CREATE POLICY "pol_delete" ON erp_purchase_order_lines FOR DELETE TO authenticated USING (erp_can_manage_inbound());
CREATE INDEX IF NOT EXISTS idx_pol_po ON erp_purchase_order_lines(purchase_order_id);

-- Supplier returns
CREATE TABLE IF NOT EXISTS erp_supplier_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text UNIQUE NOT NULL,
  supplier_id uuid NOT NULL REFERENCES erp_suppliers(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'yangi' CHECK (status IN ('yangi','yuborildi','almashtirildi','pul_qaytarildi')),
  reason text DEFAULT '',
  notes text DEFAULT '',
  sent_at timestamptz,
  closed_at timestamptz,
  created_by text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE erp_supplier_returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_select" ON erp_supplier_returns;
CREATE POLICY "sr_select" ON erp_supplier_returns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "sr_insert" ON erp_supplier_returns;
CREATE POLICY "sr_insert" ON erp_supplier_returns FOR INSERT TO authenticated WITH CHECK (erp_can_manage_inbound());
DROP POLICY IF EXISTS "sr_update" ON erp_supplier_returns;
CREATE POLICY "sr_update" ON erp_supplier_returns FOR UPDATE TO authenticated USING (erp_can_manage_inbound()) WITH CHECK (erp_can_manage_inbound());
DROP POLICY IF EXISTS "sr_delete" ON erp_supplier_returns;
CREATE POLICY "sr_delete" ON erp_supplier_returns FOR DELETE TO authenticated USING (erp_can_manage_inbound());

CREATE TABLE IF NOT EXISTS erp_supplier_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES erp_supplier_returns(id) ON DELETE CASCADE,
  product_item_id uuid NOT NULL REFERENCES erp_product_items(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE erp_supplier_return_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sri_select" ON erp_supplier_return_items;
CREATE POLICY "sri_select" ON erp_supplier_return_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "sri_insert" ON erp_supplier_return_items;
CREATE POLICY "sri_insert" ON erp_supplier_return_items FOR INSERT TO authenticated WITH CHECK (erp_can_manage_inbound());
DROP POLICY IF EXISTS "sri_update" ON erp_supplier_return_items;
CREATE POLICY "sri_update" ON erp_supplier_return_items FOR UPDATE TO authenticated USING (erp_can_manage_inbound()) WITH CHECK (erp_can_manage_inbound());
DROP POLICY IF EXISTS "sri_delete" ON erp_supplier_return_items;
CREATE POLICY "sri_delete" ON erp_supplier_return_items FOR DELETE TO authenticated USING (erp_can_manage_inbound());
CREATE INDEX IF NOT EXISTS idx_sri_return ON erp_supplier_return_items(return_id);

-- Shelves
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_warehouse_locations' AND column_name='rack') THEN
    ALTER TABLE erp_warehouse_locations ADD COLUMN rack text NOT NULL DEFAULT '01';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_warehouse_locations' AND column_name='code') THEN
    ALTER TABLE erp_warehouse_locations ADD COLUMN code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_warehouse_locations' AND column_name='capacity') THEN
    ALTER TABLE erp_warehouse_locations ADD COLUMN capacity integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_warehouse_locations' AND column_name='is_active') THEN
    ALTER TABLE erp_warehouse_locations ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;
UPDATE erp_warehouse_locations SET code = sector || '-' || rack || '-' || shelf WHERE code IS NULL;
ALTER TABLE erp_warehouse_locations ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wh_loc_code ON erp_warehouse_locations(code);

DROP POLICY IF EXISTS "wh_loc_insert" ON erp_warehouse_locations;
CREATE POLICY "wh_loc_insert" ON erp_warehouse_locations FOR INSERT TO authenticated WITH CHECK (erp_can_manage_inbound());
DROP POLICY IF EXISTS "wh_loc_update" ON erp_warehouse_locations;
CREATE POLICY "wh_loc_update" ON erp_warehouse_locations FOR UPDATE TO authenticated USING (erp_can_manage_inbound()) WITH CHECK (erp_can_manage_inbound());
DROP POLICY IF EXISTS "wh_loc_delete" ON erp_warehouse_locations;
CREATE POLICY "wh_loc_delete" ON erp_warehouse_locations FOR DELETE TO authenticated USING (erp_can_manage_inbound());

-- Product items
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_product_items' AND column_name='supplier_id') THEN
    ALTER TABLE erp_product_items ADD COLUMN supplier_id uuid REFERENCES erp_suppliers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_product_items' AND column_name='purchase_order_id') THEN
    ALTER TABLE erp_product_items ADD COLUMN purchase_order_id uuid REFERENCES erp_purchase_orders(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_product_items' AND column_name='defect_reason') THEN
    ALTER TABLE erp_product_items ADD COLUMN defect_reason text NOT NULL DEFAULT '';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pi_serial ON erp_product_items(serial_number) WHERE serial_number <> '';
CREATE INDEX IF NOT EXISTS idx_pi_location ON erp_product_items(warehouse_location_id);
CREATE INDEX IF NOT EXISTS idx_pi_supplier ON erp_product_items(supplier_id);

-- Receive against a purchase order. p_lines: [{"line_id": uuid, "good": int, "defective": int, "reason": text}]
CREATE OR REPLACE FUNCTION erp_receive_purchase(p_po_id uuid, p_lines jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_po erp_purchase_orders%ROWTYPE;
  v_line erp_purchase_order_lines%ROWTYPE;
  r jsonb;
  v_good int;
  v_bad int;
  v_total int := 0;
  v_open int;
BEGIN
  IF NOT erp_can_manage_inbound() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_po FROM erp_purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_po.status IN ('qabul_qilindi','bekor') THEN RAISE EXCEPTION 'ORDER_CLOSED'; END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_good := COALESCE((r->>'good')::int, 0);
    v_bad := COALESCE((r->>'defective')::int, 0);
    IF v_good < 0 OR v_bad < 0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
    CONTINUE WHEN v_good + v_bad = 0;
    SELECT * INTO v_line FROM erp_purchase_order_lines WHERE id = (r->>'line_id')::uuid AND purchase_order_id = p_po_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    IF v_line.quantity_received + v_good + v_bad > v_line.quantity_ordered THEN RAISE EXCEPTION 'TOO_MANY'; END IF;

    INSERT INTO erp_product_items (model_id, status, supplier_id, purchase_order_id, purchase_date, purchase_price)
      SELECT v_line.model_id, 'joylashtirish_kutilmoqda', v_po.supplier_id, p_po_id, current_date, v_line.unit_price
      FROM generate_series(1, v_good);
    INSERT INTO erp_product_items (model_id, status, supplier_id, purchase_order_id, purchase_date, purchase_price, defect_reason)
      SELECT v_line.model_id, 'qaytarish_kutilmoqda', v_po.supplier_id, p_po_id, current_date, v_line.unit_price, left(COALESCE(r->>'reason',''), 500)
      FROM generate_series(1, v_bad);

    UPDATE erp_purchase_order_lines SET quantity_received = quantity_received + v_good + v_bad WHERE id = v_line.id;
    v_total := v_total + v_good + v_bad;
  END LOOP;

  IF v_total = 0 THEN RAISE EXCEPTION 'NOTHING_TO_RECEIVE'; END IF;

  SELECT COALESCE(SUM(quantity_ordered - quantity_received), 0) INTO v_open FROM erp_purchase_order_lines WHERE purchase_order_id = p_po_id;
  UPDATE erp_purchase_orders SET status = CASE WHEN v_open = 0 THEN 'qabul_qilindi' ELSE 'qisman_qabul' END, updated_at = now() WHERE id = p_po_id;
END;
$$;

CREATE OR REPLACE FUNCTION erp_putaway_item(p_item_id uuid, p_serial text, p_location_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_serial text := btrim(COALESCE(p_serial, ''));
  v_loc erp_warehouse_locations%ROWTYPE;
  v_item erp_product_items%ROWTYPE;
BEGIN
  IF NOT erp_can_manage_inbound() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF v_serial = '' OR length(v_serial) > 100 THEN RAISE EXCEPTION 'SERIAL_REQUIRED'; END IF;
  SELECT * INTO v_loc FROM erp_warehouse_locations WHERE id = p_location_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'LOCATION_NOT_FOUND'; END IF;
  SELECT * INTO v_item FROM erp_product_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_item.status <> 'joylashtirish_kutilmoqda' THEN RAISE EXCEPTION 'NOT_AWAITING_PUTAWAY'; END IF;
  IF EXISTS (SELECT 1 FROM erp_product_items WHERE serial_number = v_serial AND id <> p_item_id) THEN
    RAISE EXCEPTION 'DUPLICATE_SERIAL';
  END IF;
  UPDATE erp_product_items SET
    serial_number = v_serial,
    barcode = CASE WHEN barcode = '' THEN v_serial ELSE barcode END,
    warehouse_location_id = v_loc.id,
    warehouse_location_shelf = v_loc.code,
    status = 'omborda_bosh',
    updated_at = now()
  WHERE id = p_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION erp_create_supplier_return(p_supplier_id uuid, p_item_ids uuid[], p_reason text, p_notes text, p_created_by text)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_count int;
BEGIN
  IF NOT erp_can_manage_inbound() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL THEN RAISE EXCEPTION 'NO_ITEMS'; END IF;
  PERFORM 1 FROM erp_suppliers WHERE id = p_supplier_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  SELECT count(*) INTO v_count FROM erp_product_items
    WHERE id = ANY(p_item_ids)
      AND status IN ('qaytarish_kutilmoqda','omborda_bosh','tamirda')
      AND (supplier_id IS NULL OR supplier_id = p_supplier_id);
  IF v_count <> array_length(p_item_ids, 1) THEN RAISE EXCEPTION 'ITEM_NOT_RETURNABLE'; END IF;

  INSERT INTO erp_supplier_returns (return_number, supplier_id, reason, notes, created_by)
  VALUES ('QT-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)),
          p_supplier_id, left(COALESCE(p_reason,''), 500), left(COALESCE(p_notes,''), 1000), left(COALESCE(p_created_by,''), 200))
  RETURNING id INTO v_id;

  INSERT INTO erp_supplier_return_items (return_id, product_item_id) SELECT v_id, unnest(p_item_ids);
  UPDATE erp_product_items SET status = 'qaytarilmoqda', supplier_id = p_supplier_id,
    warehouse_location_id = NULL, warehouse_location_shelf = '', updated_at = now()
  WHERE id = ANY(p_item_ids);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION erp_set_return_status(p_return_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_ret erp_supplier_returns%ROWTYPE;
BEGIN
  IF NOT erp_can_manage_inbound() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_ret FROM erp_supplier_returns WHERE id = p_return_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  IF p_status = 'yuborildi' AND v_ret.status = 'yangi' THEN
    UPDATE erp_supplier_returns SET status = 'yuborildi', sent_at = now() WHERE id = p_return_id;
    UPDATE erp_product_items SET status = 'qaytarildi', updated_at = now()
      WHERE id IN (SELECT product_item_id FROM erp_supplier_return_items WHERE return_id = p_return_id);
  ELSIF p_status IN ('almashtirildi','pul_qaytarildi') AND v_ret.status = 'yuborildi' THEN
    UPDATE erp_supplier_returns SET status = p_status, closed_at = now() WHERE id = p_return_id;
    IF p_status = 'almashtirildi' THEN
      INSERT INTO erp_product_items (model_id, status, supplier_id, purchase_order_id, purchase_date, purchase_price, notes)
        SELECT pi.model_id, 'joylashtirish_kutilmoqda', v_ret.supplier_id, pi.purchase_order_id, current_date, pi.purchase_price, v_ret.return_number
        FROM erp_supplier_return_items ri JOIN erp_product_items pi ON pi.id = ri.product_item_id
        WHERE ri.return_id = p_return_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION erp_receive_purchase(uuid, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION erp_putaway_item(uuid, text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION erp_create_supplier_return(uuid, uuid[], text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION erp_set_return_status(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION erp_receive_purchase(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION erp_putaway_item(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION erp_create_supplier_return(uuid, uuid[], text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION erp_set_return_status(uuid, text) TO authenticated;
