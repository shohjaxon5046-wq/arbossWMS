/*
# WMS Arenda ERP - Core Database Schema

Creates the complete database schema for a construction equipment rental, warehouse management (WMS), dispatching, and financial management ERP system.
Uses IF NOT EXISTS for idempotency. Fixed service_orders policy syntax.

## New Tables
1. erp_staff, 2. erp_warehouse_locations, 3. erp_product_models, 4. erp_product_items,
5. erp_customers, 6. erp_orders, 7. erp_order_items, 8. erp_cash_registers,
9. erp_order_payments, 10. erp_expenses, 11. erp_service_partners, 12. erp_service_orders,
13. erp_service_pricing, 14. erp_settings, 15. erp_ai_conversations, 16. erp_audit_logs

## Security: RLS on all tables, TO authenticated, shared company data model.
*/

-- 1. STAFF
CREATE TABLE IF NOT EXISTS erp_staff (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name text NOT NULL,
    phone text DEFAULT '',
    email text DEFAULT '',
    role text NOT NULL DEFAULT 'seller',
    is_active boolean DEFAULT true,
    avatar_url text DEFAULT '',
    telegram_chat_id text DEFAULT '',
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE erp_staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_select_all" ON erp_staff;
CREATE POLICY "staff_select_all" ON erp_staff FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "staff_insert_authenticated" ON erp_staff;
CREATE POLICY "staff_insert_authenticated" ON erp_staff FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "staff_update_authenticated" ON erp_staff;
CREATE POLICY "staff_update_authenticated" ON erp_staff FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "staff_delete_authenticated" ON erp_staff;
CREATE POLICY "staff_delete_authenticated" ON erp_staff FOR DELETE TO authenticated USING (true);

-- 2. WAREHOUSE LOCATIONS
CREATE TABLE IF NOT EXISTS erp_warehouse_locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sector text NOT NULL DEFAULT 'A',
    shelf text NOT NULL DEFAULT '01',
    description text DEFAULT '',
    created_at timestamptz DEFAULT now()
);
ALTER TABLE erp_warehouse_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wh_loc_select" ON erp_warehouse_locations;
CREATE POLICY "wh_loc_select" ON erp_warehouse_locations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "wh_loc_insert" ON erp_warehouse_locations;
CREATE POLICY "wh_loc_insert" ON erp_warehouse_locations FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "wh_loc_update" ON erp_warehouse_locations;
CREATE POLICY "wh_loc_update" ON erp_warehouse_locations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "wh_loc_delete" ON erp_warehouse_locations;
CREATE POLICY "wh_loc_delete" ON erp_warehouse_locations FOR DELETE TO authenticated USING (true);

-- 3. PRODUCT MODELS
CREATE TABLE IF NOT EXISTS erp_product_models (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    brand text DEFAULT '',
    category text DEFAULT '',
    daily_price numeric DEFAULT 0,
    hourly_price numeric DEFAULT 0,
    deposit_amount numeric DEFAULT 0,
    description text DEFAULT '',
    image_url text DEFAULT '',
    specs jsonb DEFAULT '{}'::jsonb,
    kit_items jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE erp_product_models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pm_select" ON erp_product_models;
CREATE POLICY "pm_select" ON erp_product_models FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pm_insert" ON erp_product_models;
CREATE POLICY "pm_insert" ON erp_product_models FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "pm_update" ON erp_product_models;
CREATE POLICY "pm_update" ON erp_product_models FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "pm_delete" ON erp_product_models;
CREATE POLICY "pm_delete" ON erp_product_models FOR DELETE TO authenticated USING (true);

-- 4. PRODUCT ITEMS
CREATE TABLE IF NOT EXISTS erp_product_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id uuid REFERENCES erp_product_models(id) ON DELETE CASCADE,
    serial_number text DEFAULT '',
    barcode text DEFAULT '',
    status text NOT NULL DEFAULT 'omborda_bosh',
    warehouse_location_id uuid REFERENCES erp_warehouse_locations(id) ON DELETE SET NULL,
    warehouse_location_shelf text DEFAULT '',
    current_order_id uuid DEFAULT NULL,
    purchase_date date,
    purchase_price numeric DEFAULT 0,
    notes text DEFAULT '',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE erp_product_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pi_select" ON erp_product_items;
CREATE POLICY "pi_select" ON erp_product_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pi_insert" ON erp_product_items;
CREATE POLICY "pi_insert" ON erp_product_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "pi_update" ON erp_product_items;
CREATE POLICY "pi_update" ON erp_product_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "pi_delete" ON erp_product_items;
CREATE POLICY "pi_delete" ON erp_product_items FOR DELETE TO authenticated USING (true);

-- 5. CUSTOMERS
CREATE TABLE IF NOT EXISTS erp_customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name text NOT NULL,
    phone_primary text DEFAULT '',
    phone_secondary text DEFAULT '',
    balance numeric DEFAULT 0,
    debt numeric DEFAULT 0,
    status text DEFAULT 'aktiv',
    passport_series text DEFAULT '',
    passport_number text DEFAULT '',
    passport_photo_url text DEFAULT '',
    address text DEFAULT '',
    notes text DEFAULT '',
    rating int DEFAULT 5,
    total_orders int DEFAULT 0,
    total_spent numeric DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE erp_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cust_select" ON erp_customers;
CREATE POLICY "cust_select" ON erp_customers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cust_insert" ON erp_customers;
CREATE POLICY "cust_insert" ON erp_customers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "cust_update" ON erp_customers;
CREATE POLICY "cust_update" ON erp_customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "cust_delete" ON erp_customers;
CREATE POLICY "cust_delete" ON erp_customers FOR DELETE TO authenticated USING (true);

-- 6. ORDERS
CREATE TABLE IF NOT EXISTS erp_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number text NOT NULL UNIQUE,
    customer_id uuid REFERENCES erp_customers(id) ON DELETE SET NULL,
    customer_name text DEFAULT '',
    customer_phone text DEFAULT '',
    status text NOT NULL DEFAULT 'yangi',
    total_rent_amount numeric DEFAULT 0,
    paid_amount numeric DEFAULT 0,
    debt_amount numeric DEFAULT 0,
    total_deposit_amount numeric DEFAULT 0,
    deposit_returned numeric DEFAULT 0,
    start_date timestamptz DEFAULT now(),
    expected_return_date timestamptz,
    actual_return_date timestamptz,
    delivery_type text DEFAULT 'pickup',
    delivery_address text DEFAULT '',
    notes text DEFAULT '',
    created_by text DEFAULT '',
    created_by_user_id uuid DEFAULT NULL,
    source text DEFAULT 'manual',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE erp_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ord_select" ON erp_orders;
CREATE POLICY "ord_select" ON erp_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ord_insert" ON erp_orders;
CREATE POLICY "ord_insert" ON erp_orders FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ord_update" ON erp_orders;
CREATE POLICY "ord_update" ON erp_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ord_delete" ON erp_orders;
CREATE POLICY "ord_delete" ON erp_orders FOR DELETE TO authenticated USING (true);

-- 7. ORDER ITEMS
CREATE TABLE IF NOT EXISTS erp_order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES erp_orders(id) ON DELETE CASCADE,
    product_item_id uuid REFERENCES erp_product_items(id) ON DELETE SET NULL,
    model_id uuid REFERENCES erp_product_models(id) ON DELETE SET NULL,
    model_name text DEFAULT '',
    serial_number text DEFAULT '',
    rent_days int DEFAULT 1,
    daily_price numeric DEFAULT 0,
    deposit_amount numeric DEFAULT 0,
    picking_status text DEFAULT 'kutilmoqda',
    return_status text DEFAULT 'mijozda',
    created_at timestamptz DEFAULT now()
);
ALTER TABLE erp_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oi_select" ON erp_order_items;
CREATE POLICY "oi_select" ON erp_order_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "oi_insert" ON erp_order_items;
CREATE POLICY "oi_insert" ON erp_order_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "oi_update" ON erp_order_items;
CREATE POLICY "oi_update" ON erp_order_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "oi_delete" ON erp_order_items;
CREATE POLICY "oi_delete" ON erp_order_items FOR DELETE TO authenticated USING (true);

-- 8. CASH REGISTERS
CREATE TABLE IF NOT EXISTS erp_cash_registers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL DEFAULT 'Bosh kassa',
    currency text DEFAULT 'UZS',
    current_balance numeric DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE erp_cash_registers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cash_select" ON erp_cash_registers;
CREATE POLICY "cash_select" ON erp_cash_registers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cash_insert" ON erp_cash_registers;
CREATE POLICY "cash_insert" ON erp_cash_registers FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "cash_update" ON erp_cash_registers;
CREATE POLICY "cash_update" ON erp_cash_registers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "cash_delete" ON erp_cash_registers;
CREATE POLICY "cash_delete" ON erp_cash_registers FOR DELETE TO authenticated USING (true);

-- 9. ORDER PAYMENTS
CREATE TABLE IF NOT EXISTS erp_order_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES erp_orders(id) ON DELETE CASCADE,
    amount numeric NOT NULL DEFAULT 0,
    payment_type text DEFAULT 'naqd',
    cash_register_id uuid REFERENCES erp_cash_registers(id) ON DELETE SET NULL,
    date timestamptz DEFAULT now(),
    notes text DEFAULT '',
    created_by text DEFAULT '',
    created_at timestamptz DEFAULT now()
);
ALTER TABLE erp_order_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pay_select" ON erp_order_payments;
CREATE POLICY "pay_select" ON erp_order_payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pay_insert" ON erp_order_payments;
CREATE POLICY "pay_insert" ON erp_order_payments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "pay_update" ON erp_order_payments;
CREATE POLICY "pay_update" ON erp_order_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "pay_delete" ON erp_order_payments;
CREATE POLICY "pay_delete" ON erp_order_payments FOR DELETE TO authenticated USING (true);

-- 10. EXPENSES
CREATE TABLE IF NOT EXISTS erp_expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL DEFAULT '',
    amount numeric NOT NULL DEFAULT 0,
    category text DEFAULT 'boshqa',
    cash_register_id uuid REFERENCES erp_cash_registers(id) ON DELETE SET NULL,
    date timestamptz DEFAULT now(),
    notes text DEFAULT '',
    created_by text DEFAULT '',
    created_at timestamptz DEFAULT now()
);
ALTER TABLE erp_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exp_select" ON erp_expenses;
CREATE POLICY "exp_select" ON erp_expenses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "exp_insert" ON erp_expenses;
CREATE POLICY "exp_insert" ON erp_expenses FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "exp_update" ON erp_expenses;
CREATE POLICY "exp_update" ON erp_expenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "exp_delete" ON erp_expenses;
CREATE POLICY "exp_delete" ON erp_expenses FOR DELETE TO authenticated USING (true);

-- 11. SERVICE PARTNERS
CREATE TABLE IF NOT EXISTS erp_service_partners (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name text NOT NULL DEFAULT '',
    service_category text NOT NULL DEFAULT 'avtokran',
    phone_primary text DEFAULT '',
    phone_secondary text DEFAULT '',
    is_available boolean DEFAULT true,
    status text DEFAULT 'bosh',
    rating int DEFAULT 5,
    notes text DEFAULT '',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE erp_service_partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sp_select" ON erp_service_partners;
CREATE POLICY "sp_select" ON erp_service_partners FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "sp_insert" ON erp_service_partners;
CREATE POLICY "sp_insert" ON erp_service_partners FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "sp_update" ON erp_service_partners;
CREATE POLICY "sp_update" ON erp_service_partners FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "sp_delete" ON erp_service_partners;
CREATE POLICY "sp_delete" ON erp_service_partners FOR DELETE TO authenticated USING (true);

-- 12. SERVICE ORDERS
CREATE TABLE IF NOT EXISTS erp_service_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number text NOT NULL UNIQUE,
    customer_id uuid REFERENCES erp_customers(id) ON DELETE SET NULL,
    customer_name text DEFAULT '',
    customer_phone text DEFAULT '',
    assigned_partner_id uuid REFERENCES erp_service_partners(id) ON DELETE SET NULL,
    service_category text NOT NULL DEFAULT '',
    service_details text DEFAULT '',
    order_status text NOT NULL DEFAULT 'yangi',
    customer_total_price numeric DEFAULT 0,
    partner_cost numeric DEFAULT 0,
    net_profit numeric DEFAULT 0,
    address text DEFAULT '',
    scheduled_time text DEFAULT '',
    completed_at timestamptz,
    notes text DEFAULT '',
    created_by text DEFAULT '',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE erp_service_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "so_select" ON erp_service_orders;
CREATE POLICY "so_select" ON erp_service_orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "so_insert" ON erp_service_orders;
CREATE POLICY "so_insert" ON erp_service_orders FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "so_update" ON erp_service_orders;
CREATE POLICY "so_update" ON erp_service_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "so_delete" ON erp_service_orders;
CREATE POLICY "so_delete" ON erp_service_orders FOR DELETE TO authenticated USING (true);

-- 13. SERVICE PRICING
CREATE TABLE IF NOT EXISTS erp_service_pricing (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id uuid REFERENCES erp_service_partners(id) ON DELETE CASCADE,
    service_type_detail text NOT NULL DEFAULT '',
    selling_price numeric DEFAULT 0,
    cost_price numeric DEFAULT 0,
    unit text DEFAULT 'soat',
    min_order numeric DEFAULT 0,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE erp_service_pricing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "spr_select" ON erp_service_pricing;
CREATE POLICY "spr_select" ON erp_service_pricing FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "spr_insert" ON erp_service_pricing;
CREATE POLICY "spr_insert" ON erp_service_pricing FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "spr_update" ON erp_service_pricing;
CREATE POLICY "spr_update" ON erp_service_pricing FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "spr_delete" ON erp_service_pricing;
CREATE POLICY "spr_delete" ON erp_service_pricing FOR DELETE TO authenticated USING (true);

-- 14. SETTINGS
CREATE TABLE IF NOT EXISTS erp_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key text NOT NULL UNIQUE,
    value jsonb DEFAULT '{}'::jsonb,
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE erp_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "set_select" ON erp_settings;
CREATE POLICY "set_select" ON erp_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "set_insert" ON erp_settings;
CREATE POLICY "set_insert" ON erp_settings FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "set_update" ON erp_settings;
CREATE POLICY "set_update" ON erp_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "set_delete" ON erp_settings;
CREATE POLICY "set_delete" ON erp_settings FOR DELETE TO authenticated USING (true);

-- 15. AI CONVERSATIONS
CREATE TABLE IF NOT EXISTS erp_ai_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id text NOT NULL DEFAULT 'default',
    role text NOT NULL DEFAULT 'user',
    content text NOT NULL DEFAULT '',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE erp_ai_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_select" ON erp_ai_conversations;
CREATE POLICY "ai_select" ON erp_ai_conversations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ai_insert" ON erp_ai_conversations;
CREATE POLICY "ai_insert" ON erp_ai_conversations FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ai_update" ON erp_ai_conversations;
CREATE POLICY "ai_update" ON erp_ai_conversations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ai_delete" ON erp_ai_conversations;
CREATE POLICY "ai_delete" ON erp_ai_conversations FOR DELETE TO authenticated USING (true);

-- 16. AUDIT LOGS
CREATE TABLE IF NOT EXISTS erp_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    action text NOT NULL DEFAULT '',
    entity_type text DEFAULT '',
    entity_id text DEFAULT '',
    details jsonb DEFAULT '{}'::jsonb,
    user_id uuid DEFAULT NULL,
    user_name text DEFAULT '',
    created_at timestamptz DEFAULT now()
);
ALTER TABLE erp_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_select" ON erp_audit_logs;
CREATE POLICY "audit_select" ON erp_audit_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "audit_insert" ON erp_audit_logs;
CREATE POLICY "audit_insert" ON erp_audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_pm_category ON erp_product_models(category);
CREATE INDEX IF NOT EXISTS idx_pi_status ON erp_product_items(status);
CREATE INDEX IF NOT EXISTS idx_pi_barcode ON erp_product_items(barcode);
CREATE INDEX IF NOT EXISTS idx_pi_model ON erp_product_items(model_id);
CREATE INDEX IF NOT EXISTS idx_cust_phone ON erp_customers(phone_primary);
CREATE INDEX IF NOT EXISTS idx_ord_status ON erp_orders(status);
CREATE INDEX IF NOT EXISTS idx_ord_customer ON erp_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_oi_order ON erp_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_pay_order ON erp_order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_exp_date ON erp_expenses(date);
CREATE INDEX IF NOT EXISTS idx_so_status ON erp_service_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_so_partner ON erp_service_orders(assigned_partner_id);
CREATE INDEX IF NOT EXISTS idx_staff_user ON erp_staff(user_id);
