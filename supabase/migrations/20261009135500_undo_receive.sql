CREATE OR REPLACE FUNCTION erp_undo_receive_purchase(p_po_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_po erp_purchase_orders%ROWTYPE;
  v_invalid_count int;
BEGIN
  IF NOT erp_can_manage_inbound() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT * INTO v_po FROM erp_purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  
  -- Check if any items are already rented out or beyond initial stages
  SELECT count(*) INTO v_invalid_count 
  FROM erp_product_items 
  WHERE purchase_order_id = p_po_id 
    AND status NOT IN ('joylashtirish_kutilmoqda', 'qaytarish_kutilmoqda', 'omborda_bosh');

  IF v_invalid_count > 0 THEN 
    RAISE EXCEPTION 'ITEMS_ALREADY_IN_USE'; 
  END IF;

  -- Delete the items generated from this PO
  DELETE FROM erp_product_items WHERE purchase_order_id = p_po_id;

  -- Reset received quantities
  UPDATE erp_purchase_order_lines SET quantity_received = 0 WHERE purchase_order_id = p_po_id;

  -- Reset PO status to 'yuborildi'
  UPDATE erp_purchase_orders SET status = 'yuborildi', updated_at = now() WHERE id = p_po_id;

END;
$$;

REVOKE EXECUTE ON FUNCTION erp_undo_receive_purchase(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION erp_undo_receive_purchase(uuid) TO authenticated;
