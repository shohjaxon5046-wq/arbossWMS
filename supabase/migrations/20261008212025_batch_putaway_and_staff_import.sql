/*
# Batch putaway (bitta chekka bilan barcha kirim joylashtirish)

1. New function
- `erp_putaway_batch(p_entries jsonb)` - bir kirimdagi barcha yaroqli uskunalarni BIR joylashtirish
  amalida polkaga qo'yadi. Har bir yozuv: {"item_id": uuid, "serial": text, "location_id": uuid}.
  Avval hammasini tekshiradi (ruxsat, seriya, polka, holat, dublikat), so'ng bir-bir joylaydi.

2. Security
- Invoker funksiya, `erp_can_manage_inbound()` tekshiradi; anon/PUBLIC uchun yopiq, authenticated uchun ochiq.

3. Notes
- Idempotent qayta yaratish; ma'lumot o'chirilmaydi.
*/

CREATE OR REPLACE FUNCTION erp_putaway_batch(p_entries jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  r jsonb;
  v_serial text;
  v_item_id uuid;
  v_loc_id uuid;
  v_loc erp_warehouse_locations%ROWTYPE;
  v_item erp_product_items%ROWTYPE;
  v_serials text[] := ARRAY[]::text[];
BEGIN
  IF NOT erp_can_manage_inbound() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' OR jsonb_array_length(p_entries) = 0 THEN
    RAISE EXCEPTION 'NOTHING_TO_PLACE';
  END IF;

  -- 1) hammasini tekshirish
  FOR r IN SELECT * FROM jsonb_array_elements(p_entries) LOOP
    v_serial := btrim(COALESCE(r->>'serial', ''));
    v_item_id := NULLIF(r->>'item_id', '')::uuid;
    v_loc_id   := NULLIF(r->>'location_id', '')::uuid;

    IF v_item_id IS NULL THEN RAISE EXCEPTION 'INVALID_ITEM'; END IF;
    IF v_serial = '' OR length(v_serial) > 100 THEN RAISE EXCEPTION 'SERIAL_REQUIRED'; END IF;
    IF v_loc_id IS NULL THEN RAISE EXCEPTION 'LOCATION_NOT_FOUND'; END IF;

    SELECT * INTO v_loc FROM erp_warehouse_locations WHERE id = v_loc_id AND is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'LOCATION_NOT_FOUND'; END IF;

    SELECT * INTO v_item FROM erp_product_items WHERE id = v_item_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
    IF v_item.status <> 'joylashtirish_kutilmoqda' THEN RAISE EXCEPTION 'NOT_AWAITING_PUTAWAY'; END IF;

    v_serials := array_append(v_serials, lower(v_serial));
  END LOOP;

  -- partiya ichida dublikat
  IF EXISTS (
    SELECT 1 FROM unnest(v_serials) AS s GROUP BY s HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'DUPLICATE_SERIAL'; END IF;

  -- mavjud qatorlar bilan to'qnashuv
  IF EXISTS (
    SELECT 1 FROM erp_product_items WHERE lower(serial_number) = ANY(v_serials) AND serial_number <> ''
  ) THEN RAISE EXCEPTION 'DUPLICATE_SERIAL'; END IF;

  -- 2) joylashtirish
  FOR r IN SELECT * FROM jsonb_array_elements(p_entries) LOOP
    v_serial := btrim(COALESCE(r->>'serial', ''));
    v_item_id := (r->>'item_id')::uuid;
    v_loc_id   := (r->>'location_id')::uuid;

    SELECT * INTO v_loc FROM erp_warehouse_locations WHERE id = v_loc_id;
    UPDATE erp_product_items SET
      serial_number = v_serial,
      barcode = CASE WHEN barcode = '' THEN v_serial ELSE barcode END,
      warehouse_location_id = v_loc.id,
      warehouse_location_shelf = v_loc.code,
      status = 'omborda_bosh',
      updated_at = now()
    WHERE id = v_item_id;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION erp_putaway_batch(jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION erp_putaway_batch(jsonb) TO authenticated;
