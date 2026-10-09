-- Add balance to suppliers
ALTER TABLE erp_suppliers ADD COLUMN IF NOT EXISTS balance numeric(15,2) NOT NULL DEFAULT 0;

-- Supplier transactions table
CREATE TABLE IF NOT EXISTS erp_supplier_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES erp_suppliers(id) ON DELETE CASCADE,
  transaction_type varchar(50) NOT NULL CHECK (transaction_type IN ('payment', 'purchase', 'return', 'adjustment')),
  amount numeric(15,2) NOT NULL,
  currency varchar(10) NOT NULL DEFAULT 'UZS',
  reference_id uuid, -- Can be purchase_order_id or return_id
  date timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE erp_supplier_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "st_select" ON erp_supplier_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "st_insert" ON erp_supplier_transactions FOR INSERT TO authenticated WITH CHECK (erp_can_manage_inbound());
CREATE POLICY "st_update" ON erp_supplier_transactions FOR UPDATE TO authenticated USING (erp_can_manage_inbound()) WITH CHECK (erp_can_manage_inbound());
CREATE POLICY "st_delete" ON erp_supplier_transactions FOR DELETE TO authenticated USING (erp_can_manage_inbound());

-- Trigger to update supplier balance automatically
CREATE OR REPLACE FUNCTION erp_update_supplier_balance()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.transaction_type IN ('purchase') THEN
      UPDATE erp_suppliers SET balance = balance - NEW.amount WHERE id = NEW.supplier_id;
    ELSIF NEW.transaction_type IN ('payment', 'return', 'adjustment') THEN
      UPDATE erp_suppliers SET balance = balance + NEW.amount WHERE id = NEW.supplier_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.transaction_type IN ('purchase') THEN
      UPDATE erp_suppliers SET balance = balance + OLD.amount WHERE id = OLD.supplier_id;
    ELSIF OLD.transaction_type IN ('payment', 'return', 'adjustment') THEN
      UPDATE erp_suppliers SET balance = balance - OLD.amount WHERE id = OLD.supplier_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supplier_transaction ON erp_supplier_transactions;
CREATE TRIGGER trg_supplier_transaction
AFTER INSERT OR DELETE ON erp_supplier_transactions
FOR EACH ROW EXECUTE FUNCTION erp_update_supplier_balance();

-- Create an index for faster queries
CREATE INDEX IF NOT EXISTS idx_st_supplier ON erp_supplier_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_st_date ON erp_supplier_transactions(date);
