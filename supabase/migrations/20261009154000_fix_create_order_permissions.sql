-- Fix permission issue for erp_create_order calling the restricted core function
CREATE OR REPLACE FUNCTION erp_create_order(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT erp_can_sell() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN erp_create_order_core(p, auth.uid());
END;
$$;
