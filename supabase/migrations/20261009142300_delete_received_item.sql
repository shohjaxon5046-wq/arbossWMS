CREATE OR REPLACE FUNCTION erp_delete_received_item(p_item_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_item erp_product_items%ROWTYPE;
  v_po_line erp_purchase_order_lines%ROWTYPE;
  v_po erp_purchase_orders%ROWTYPE;
BEGIN
  IF NOT erp_can_manage_inbound() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT * INTO v_item FROM erp_product_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  IF v_item.status NOT IN ('joylashtirish_kutilmoqda', 'qaytarish_kutilmoqda', 'omborda_bosh') THEN
    RAISE EXCEPTION 'ITEM_IN_USE';
  END IF;

  IF v_item.purchase_order_id IS NULL THEN
    RAISE EXCEPTION 'NO_PO';
  END IF;

  -- Decrease received quantity by 1
  UPDATE erp_purchase_order_lines 
  SET quantity_received = quantity_received - 1 
  WHERE purchase_order_id = v_item.purchase_order_id AND model_id = v_item.model_id
  RETURNING * INTO v_po_line;

  -- Update PO status if it was fully received
  SELECT * INTO v_po FROM erp_purchase_orders WHERE id = v_item.purchase_order_id FOR UPDATE;
  IF v_po.status = 'qabul_qilindi' THEN
    UPDATE erp_purchase_orders SET status = 'qisman_qabul', updated_at = now() WHERE id = v_po.id;
  END IF;

  -- Delete item
  DELETE FROM erp_product_items WHERE id = p_item_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION erp_delete_received_item(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION erp_delete_received_item(uuid) TO authenticated;
