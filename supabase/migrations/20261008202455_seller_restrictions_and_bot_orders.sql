/*
# Seller restrictions + Telegram order taking

1. Visibility (RLS)
- `erp_orders`: sellers now see ONLY orders they created themselves. Admin, manager,
  cashier and warehouse still see all orders. Other roles are unchanged.
- `erp_order_items`, `erp_order_payments`, `erp_service_orders`: sellers see lines only
  of their own orders (checked through the parent order). Other roles see everything.

2. Status changes taken away from sellers
- `erp_set_order_status`: now only admin, manager and warehouse (was: all sales roles).
- `erp_set_service_status`: now only admin and manager (was: all sales roles).

3. Order creation refactor (no behavior change for the web app)
- New `erp_create_order_core(p jsonb, p_staff_user uuid)` (SECURITY DEFINER) contains the
  existing order-creation logic, but takes the staff user id as a parameter instead of
  reading auth.uid().
- `erp_create_order(p jsonb)` is now a thin wrapper: checks erp_can_sell() then calls the core.
- New `erp_bot_create_order(p jsonb, p_chat_id text)` (SECURITY DEFINER): the Telegram bot
  passes the chat id; the function finds the linked active staff, verifies a sales role,
  then creates the order through the same core. Revoked from anon.

4. New table
- `erp_bot_draft` (chat_id primary key, stage, data jsonb): one order draft per Telegram
  chat while the seller types an order step by step. RLS enabled with NO policies:
  only the bot server (service role) reads and writes it.

5. Indexes
- `idx_ord_created_by` on erp_orders(created_by_user_id) for the seller visibility filter.
*/

-- 1. Visibility
DROP POLICY IF EXISTS "ord_select" ON erp_orders;
CREATE POLICY "ord_select" ON erp_orders FOR SELECT TO authenticated
USING (
  (SELECT COALESCE(erp_staff_role() IN ('admin','manager','cashier','warehouse'), false))
  OR created_by_user_id = auth.uid()
);

DROP POLICY IF EXISTS "oi_select" ON erp_order_items;
CREATE POLICY "oi_select" ON erp_order_items FOR SELECT TO authenticated
USING (
  (SELECT COALESCE(erp_staff_role() IN ('admin','manager','cashier','warehouse'), false))
  OR EXISTS (
    SELECT 1 FROM erp_orders o
    WHERE o.id = erp_order_items.order_id AND o.created_by_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "pay_select" ON erp_order_payments;
CREATE POLICY "pay_select" ON erp_order_payments FOR SELECT TO authenticated
USING (
  (SELECT COALESCE(erp_staff_role() IN ('admin','manager','cashier','warehouse'), false))
  OR EXISTS (
    SELECT 1 FROM erp_orders o
    WHERE o.id = erp_order_payments.order_id AND o.created_by_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "so_select" ON erp_service_orders;
CREATE POLICY "so_select" ON erp_service_orders FOR SELECT TO authenticated
USING (
  (SELECT COALESCE(erp_staff_role() IN ('admin','manager','cashier','warehouse'), false))
  OR EXISTS (
    SELECT 1 FROM erp_orders o
    WHERE o.id = erp_service_orders.order_id AND o.created_by_user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_ord_created_by ON erp_orders(created_by_user_id);

-- 2. Status changes: sellers excluded
CREATE OR REPLACE FUNCTION erp_set_order_status(p_order_id uuid, p_status text) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_order erp_orders%ROWTYPE;
  v_line record;
  v_dep numeric;
BEGIN
  IF COALESCE(erp_staff_role() IN ('admin','manager','warehouse'), false) = false THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v_order FROM erp_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT (
    (v_order.status = 'yangi' AND p_status IN ('yigilmoqda','faol_ijarada','yakunlandi','bekor')) OR
    (v_order.status = 'yigilmoqda' AND p_status IN ('faol_ijarada','yakunlandi','bekor')) OR
    (v_order.status IN ('faol_ijarada','kechikkan') AND p_status IN ('yakunlandi','bekor'))
  ) THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;

  FOR v_line IN
    SELECT oi.id, oi.rent_days, oi.line_total, i.id item_id, i.purchase_price, i.depreciation_total,
           COALESCE(i.depreciation_pct, m.depreciation_pct, 0) pct
    FROM erp_order_items oi
    JOIN erp_product_items i ON i.id = oi.product_item_id
    LEFT JOIN erp_product_models m ON m.id = i.model_id
    WHERE oi.order_id = p_order_id AND oi.return_status <> 'qaytarildi' AND i.current_order_id = p_order_id
    FOR UPDATE OF i
  LOOP
    IF p_status = 'yakunlandi' THEN
      v_dep := LEAST(round(COALESCE(v_line.purchase_price,0) * v_line.pct / 100),
                     GREATEST(COALESCE(v_line.purchase_price,0) - v_line.depreciation_total, 0));
      UPDATE erp_product_items SET status = 'omborda_bosh', current_order_id = NULL,
        rental_count = rental_count + 1, rental_days_total = rental_days_total + v_line.rent_days,
        revenue_total = revenue_total + v_line.line_total, depreciation_total = depreciation_total + v_dep,
        updated_at = now()
      WHERE id = v_line.item_id;
      UPDATE erp_order_items SET return_status = 'qaytarildi', depreciation_applied = v_dep WHERE id = v_line.id;
    ELSIF p_status = 'bekor' THEN
      UPDATE erp_product_items SET status = 'omborda_bosh', current_order_id = NULL, updated_at = now()
      WHERE id = v_line.item_id;
      UPDATE erp_order_items SET return_status = 'qaytarildi' WHERE id = v_line.id;
    END IF;
  END LOOP;

  IF p_status = 'bekor' THEN
    UPDATE erp_service_partners sp SET is_available = true, status = 'bosh'
    WHERE sp.id IN (SELECT assigned_partner_id FROM erp_service_orders
                    WHERE order_id = p_order_id AND order_status NOT IN ('bajarildi','bekor') AND assigned_partner_id IS NOT NULL);
    UPDATE erp_service_orders SET order_status = 'bekor', updated_at = now()
    WHERE order_id = p_order_id AND order_status NOT IN ('bajarildi','bekor');
  END IF;

  UPDATE erp_orders SET status = p_status,
    actual_return_date = CASE WHEN p_status = 'yakunlandi' THEN now() ELSE actual_return_date END,
    debt_amount = CASE WHEN p_status = 'bekor' THEN 0 ELSE debt_amount END,
    updated_at = now()
  WHERE id = p_order_id;
  IF v_order.customer_id IS NOT NULL THEN PERFORM erp_refresh_customer(v_order.customer_id); END IF;
END;
$$;

CREATE OR REPLACE FUNCTION erp_set_service_status(p_service_id uuid, p_status text) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_svc erp_service_orders%ROWTYPE;
BEGIN
  IF COALESCE(erp_staff_role() IN ('admin','manager'), false) = false THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_status NOT IN ('yangi','hamkor_qabul_qildi','hamkor_yolda','bajarilmoqda','bajarildi','bekor') THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;
  SELECT * INTO v_svc FROM erp_service_orders WHERE id = p_service_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_svc.order_status IN ('bajarildi','bekor') THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
  UPDATE erp_service_orders SET order_status = p_status,
    completed_at = CASE WHEN p_status = 'bajarildi' THEN now() ELSE completed_at END, updated_at = now()
  WHERE id = p_service_id;
  IF p_status IN ('bajarildi','bekor') AND v_svc.assigned_partner_id IS NOT NULL THEN
    UPDATE erp_service_partners SET is_available = true, status = 'bosh' WHERE id = v_svc.assigned_partner_id;
  END IF;
END;
$$;

-- 3. Order creation core + bot entry point
CREATE OR REPLACE FUNCTION erp_create_order_core(p jsonb, p_staff_user uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer erp_customers%ROWTYPE;
  v_days int := COALESCE((p->>'rent_days')::int, 1);
  v_item_ids uuid[];
  v_services jsonb := COALESCE(p->'services', '[]'::jsonb);
  v_order_id uuid;
  v_number text;
  v_item record;
  v_disc numeric;
  v_line numeric;
  v_rent numeric := 0;
  v_gross numeric := 0;
  v_deposit numeric := 0;
  v_service_total numeric := 0;
  v_svc jsonb;
  v_svc_price numeric;
  v_svc_cost numeric;
  v_n int := 0;
  v_pay numeric := COALESCE((p->'payment'->>'amount')::numeric, 0);
  v_pay_type text := COALESCE(p->'payment'->>'type', 'naqd');
  v_register uuid := NULLIF(p->'payment'->>'register_id', '')::uuid;
  v_total numeric;
  v_staff_name text;
BEGIN
  SELECT * INTO v_customer FROM erp_customers WHERE id = NULLIF(p->>'customer_id','')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOMER_REQUIRED'; END IF;
  IF v_days < 1 OR v_days > 365 THEN RAISE EXCEPTION 'INVALID_DAYS'; END IF;

  SELECT COALESCE(array_agg(DISTINCT x::uuid), '{}') INTO v_item_ids
  FROM jsonb_array_elements_text(COALESCE(p->'item_ids','[]'::jsonb)) x;
  IF jsonb_typeof(v_services) <> 'array' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  IF cardinality(v_item_ids) = 0 AND jsonb_array_length(v_services) = 0 THEN RAISE EXCEPTION 'EMPTY_ORDER'; END IF;
  IF cardinality(v_item_ids) > 100 OR jsonb_array_length(v_services) > 20 THEN RAISE EXCEPTION 'TOO_MANY'; END IF;
  IF v_pay < 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  IF v_pay_type NOT IN ('naqd','plastik','o''tkazma') THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;

  SELECT full_name INTO v_staff_name FROM erp_staff WHERE user_id = p_staff_user;
  v_number := 'ORD-' || lpad(nextval('erp_order_number_seq')::text, 5, '0');

  INSERT INTO erp_orders (order_number, customer_id, customer_name, customer_phone, status, start_date,
    expected_return_date, delivery_type, delivery_address, notes, created_by, created_by_user_id)
  VALUES (v_number, v_customer.id, v_customer.full_name, v_customer.phone_primary, 'yangi', now(),
    CASE WHEN cardinality(v_item_ids) > 0 THEN now() + make_interval(days => v_days) END,
    CASE WHEN p->>'delivery_type' = 'delivery' THEN 'delivery' ELSE 'pickup' END,
    left(COALESCE(p->>'delivery_address',''), 300), left(COALESCE(p->>'notes',''), 1000),
    COALESCE(v_staff_name, ''), p_staff_user)
  RETURNING id INTO v_order_id;

  FOR v_item IN
    SELECT i.id, i.serial_number, i.status, m.id model_id, m.name, m.daily_price, m.deposit_amount,
           m.weekly_discount_pct, m.monthly_discount_pct, m.is_active
    FROM erp_product_items i JOIN erp_product_models m ON m.id = i.model_id
    WHERE i.id = ANY(v_item_ids) ORDER BY i.id FOR UPDATE OF i
  LOOP
    IF v_item.status <> 'omborda_bosh' OR NOT v_item.is_active THEN RAISE EXCEPTION 'ITEM_UNAVAILABLE'; END IF;
    v_disc := CASE
      WHEN v_days >= 30 AND v_item.monthly_discount_pct > 0 THEN v_item.monthly_discount_pct
      WHEN v_days >= 7 AND v_item.weekly_discount_pct > 0 THEN v_item.weekly_discount_pct
      ELSE 0 END;
    v_line := round(v_item.daily_price * v_days * (100 - v_disc) / 100);
    v_gross := v_gross + v_item.daily_price * v_days;
    v_rent := v_rent + v_line;
    v_deposit := v_deposit + v_item.deposit_amount;
    v_n := v_n + 1;
    INSERT INTO erp_order_items (order_id, product_item_id, model_id, model_name, serial_number, rent_days,
      daily_price, deposit_amount, discount_pct, line_total)
    VALUES (v_order_id, v_item.id, v_item.model_id, v_item.name, v_item.serial_number, v_days,
      v_item.daily_price, v_item.deposit_amount, v_disc, v_line);
    UPDATE erp_product_items SET status = 'ijarada', current_order_id = v_order_id, updated_at = now()
    WHERE id = v_item.id;
  END LOOP;
  IF v_n <> cardinality(v_item_ids) THEN RAISE EXCEPTION 'ITEM_UNAVAILABLE'; END IF;

  v_n := 0;
  FOR v_svc IN SELECT * FROM jsonb_array_elements(v_services) LOOP
    v_n := v_n + 1;
    v_svc_price := COALESCE((v_svc->>'customer_price')::numeric, 0);
    v_svc_cost := COALESCE((v_svc->>'partner_cost')::numeric, 0);
    IF v_svc_price < 0 OR v_svc_cost < 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
    IF btrim(COALESCE(v_svc->>'category','')) = '' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
    v_service_total := v_service_total + v_svc_price;
    INSERT INTO erp_service_orders (order_id, order_number, customer_id, customer_name, customer_phone,
      assigned_partner_id, service_category, service_details, order_status, customer_total_price,
      partner_cost, net_profit, address, scheduled_time, created_by)
    VALUES (v_order_id, v_number || '-S' || v_n, v_customer.id, v_customer.full_name, v_customer.phone_primary,
      NULLIF(v_svc->>'partner_id','')::uuid, left(v_svc->>'category', 100), left(COALESCE(v_svc->>'details',''), 1000),
      'yangi', v_svc_price, v_svc_cost, v_svc_price - v_svc_cost, left(COALESCE(v_svc->>'address',''), 300),
      left(COALESCE(v_svc->>'scheduled_time',''), 100), COALESCE(v_staff_name, ''));
    IF NULLIF(v_svc->>'partner_id','') IS NOT NULL THEN
      UPDATE erp_service_partners SET is_available = false, status = 'band' WHERE id = (v_svc->>'partner_id')::uuid;
    END IF;
  END LOOP;

  v_total := v_rent + v_service_total;
  IF v_pay > v_total THEN RAISE EXCEPTION 'OVERPAYMENT'; END IF;

  UPDATE erp_orders SET total_rent_amount = v_total, total_service_amount = v_service_total,
    discount_amount = v_gross - v_rent, total_deposit_amount = v_deposit,
    paid_amount = v_pay, debt_amount = v_total - v_pay
  WHERE id = v_order_id;

  IF v_pay > 0 THEN
    IF v_register IS NOT NULL THEN
      UPDATE erp_cash_registers SET current_balance = current_balance + v_pay WHERE id = v_register AND is_active;
      IF NOT FOUND THEN RAISE EXCEPTION 'REGISTER_NOT_FOUND'; END IF;
    END IF;
    INSERT INTO erp_order_payments (order_id, amount, payment_type, cash_register_id, date, created_by)
    VALUES (v_order_id, v_pay, v_pay_type, v_register, now(), COALESCE(v_staff_name, ''));
  END IF;

  PERFORM erp_refresh_customer(v_customer.id);
  RETURN jsonb_build_object('id', v_order_id, 'order_number', v_number);
END;
$$;

CREATE OR REPLACE FUNCTION erp_create_order(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT erp_can_sell() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN erp_create_order_core(p, auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION erp_bot_create_order(p jsonb, p_chat_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid;
BEGIN
  SELECT user_id INTO v_user FROM erp_staff
  WHERE telegram_chat_id = p_chat_id AND is_active = true
    AND role IN ('admin','manager','seller','cashier')
  LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN erp_create_order_core(p, v_user);
END;
$$;

REVOKE EXECUTE ON FUNCTION erp_create_order_core(jsonb, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION erp_bot_create_order(jsonb, text) FROM anon;

-- 4. Telegram order drafts (bot-only table)
CREATE TABLE IF NOT EXISTS erp_bot_draft (
    chat_id text PRIMARY KEY,
    stage text NOT NULL,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE erp_bot_draft ENABLE ROW LEVEL SECURITY;
