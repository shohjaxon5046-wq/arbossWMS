/*
# Catalog edit permissions and price protection

1. Modified policies
- `erp_product_models`: insert/update/delete now limited to catalog editors (admin, manager, warehouse) via `erp_can_edit_catalog()`. Reading is unchanged.

2. New triggers
- `erp_guard_model_prices`: only admin or manager may set or change daily/hourly price, deposit, 7+/30+ day discounts, depreciation % and the "rentable" flag. Others get error `PRICE_FORBIDDEN`.
- `erp_guard_item_depreciation`: only admin or manager may change a unit's personal depreciation % override.

3. Notes
1. Checks are skipped when there is no signed-in user (backend maintenance).
2. No data is changed.
*/

DROP POLICY IF EXISTS "pm_insert" ON erp_product_models;
CREATE POLICY "pm_insert" ON erp_product_models FOR INSERT TO authenticated WITH CHECK (erp_can_edit_catalog());

DROP POLICY IF EXISTS "pm_update" ON erp_product_models;
CREATE POLICY "pm_update" ON erp_product_models FOR UPDATE TO authenticated USING (erp_can_edit_catalog()) WITH CHECK (erp_can_edit_catalog());

DROP POLICY IF EXISTS "pm_delete" ON erp_product_models;
CREATE POLICY "pm_delete" ON erp_product_models FOR DELETE TO authenticated USING (erp_can_edit_catalog());

CREATE OR REPLACE FUNCTION erp_guard_model_prices()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR COALESCE(erp_staff_role() IN ('admin','manager'), false) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.daily_price,0) <> 0 OR COALESCE(NEW.hourly_price,0) <> 0 OR COALESCE(NEW.deposit_amount,0) <> 0
       OR COALESCE(NEW.weekly_discount_pct,0) <> 0 OR COALESCE(NEW.monthly_discount_pct,0) <> 0
       OR NEW.depreciation_pct IS DISTINCT FROM 2 THEN
      RAISE EXCEPTION 'PRICE_FORBIDDEN';
    END IF;
  ELSIF NEW.daily_price IS DISTINCT FROM OLD.daily_price
     OR NEW.hourly_price IS DISTINCT FROM OLD.hourly_price
     OR NEW.deposit_amount IS DISTINCT FROM OLD.deposit_amount
     OR NEW.weekly_discount_pct IS DISTINCT FROM OLD.weekly_discount_pct
     OR NEW.monthly_discount_pct IS DISTINCT FROM OLD.monthly_discount_pct
     OR NEW.depreciation_pct IS DISTINCT FROM OLD.depreciation_pct
     OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'PRICE_FORBIDDEN';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS erp_guard_model_prices ON erp_product_models;
CREATE TRIGGER erp_guard_model_prices BEFORE INSERT OR UPDATE ON erp_product_models
FOR EACH ROW EXECUTE FUNCTION erp_guard_model_prices();

CREATE OR REPLACE FUNCTION erp_guard_item_depreciation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR COALESCE(erp_staff_role() IN ('admin','manager'), false) THEN
    RETURN NEW;
  END IF;
  IF (TG_OP = 'INSERT' AND NEW.depreciation_pct IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.depreciation_pct IS DISTINCT FROM OLD.depreciation_pct) THEN
    RAISE EXCEPTION 'PRICE_FORBIDDEN';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS erp_guard_item_depreciation ON erp_product_items;
CREATE TRIGGER erp_guard_item_depreciation BEFORE INSERT OR UPDATE ON erp_product_items
FOR EACH ROW EXECUTE FUNCTION erp_guard_item_depreciation();
