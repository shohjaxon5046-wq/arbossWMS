/*
# Xodimlarni ommaviy qo'shish va admin xodim login tahriri

1. New function (service_role uchun, SECURITY DEFINER)
- `erp_admin_can_pass()` - chaqiruvchi service_role yoki admin ekanini tekshiradi (ichki yordamchi).
- `erp_staff_import(p_rows jsonb)` - Excel import uchun: har bir qator {full_name, phone, role, email, password}.
  Eslatma: autentifikatsiya foydalanuvchisini YARATMAYDI (baza yaratib berolmaydi) - faqat erp_staff bot-qatori ochadi.
- `erp_staff_set_login(p_staff_id uuid, p_email text, p_password text)` - admin eski xodimga email/parol
  o'rnatish uchun. Mavjud email-account bo'lsa parol yangilanadi; bo'lmasa yangi hisob ochilib bog'lanadi.
  (email/parol qiymati maxfiy saqlanmaydi; parol auth.users'da xeshlanadi.)

2. Security
- `erp_admin_can_pass()` va `erp_staff_set_login` SECURITY DEFINER, search_path qat'iy, chaqiruvchi admin ekani
  `auth.uid()` orqali tekshiriladi. `erp_staff_import` ham xuddi shunday himoyalangan.
- EXECUTE: anon/PUBLIC dan olingan, authenticated'ga berilgan.

3. Notes
- Parol kamida 6 belgi; email format tekshiriladi.
- Ma'lumot o'chirilmaydi.
*/

-- admin ekanini tekshiruvchi SECURITY DEFINER yordamchi
CREATE OR REPLACE FUNCTION erp_admin_can_pass()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM erp_staff
    WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
  );
END;
$$;

-- Xodimlarni xom ashyo (bot-login) sifatida ommaviy qo'shish
CREATE OR REPLACE FUNCTION erp_staff_import(p_rows jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  v_name text;
  v_phone text;
  v_role text;
  v_email text;
  v_count int := 0;
BEGIN
  IF NOT erp_admin_can_pass() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'NO_ROWS';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_name := btrim(COALESCE(r->>'full_name', ''));
    v_phone := btrim(COALESCE(r->>'phone', ''));
    v_role := COALESCE(r->>'role', 'seller');
    v_email := lower(btrim(COALESCE(r->>'email', '')));

    IF v_name = '' THEN CONTINUE; END IF;
    IF v_role NOT IN ('admin','manager','seller','cashier','warehouse') THEN
      RAISE EXCEPTION 'INVALID_ROLE';
    END IF;

    INSERT INTO erp_staff (full_name, phone, role, email, is_active)
    VALUES (left(v_name, 200), left(v_phone, 50), v_role, left(v_email, 255), true)
    ON CONFLICT DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN RAISE EXCEPTION 'NO_ROWS'; END IF;
  RETURN v_count;
END;
$$;

-- Eski xodimga login (email+parol) berish / yangilash
CREATE OR REPLACE FUNCTION erp_staff_set_login(p_staff_id uuid, p_email text, p_password text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff erp_staff%ROWTYPE;
  v_email text;
  v_uid uuid;
BEGIN
  IF NOT erp_admin_can_pass() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_staff_id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  v_email := lower(btrim(COALESCE(p_email, '')));
  IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'INVALID_EMAIL';
  END IF;
  IF length(COALESCE(p_password, '')) < 6 THEN
    RAISE EXCEPTION 'PASSWORD_TOO_SHORT';
  END IF;

  SELECT * INTO v_staff FROM erp_staff WHERE id = p_staff_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;

  -- boshqa xodimga bog'langan email?
  IF EXISTS (SELECT 1 FROM erp_staff WHERE email = v_email AND id <> p_staff_id) THEN
    RAISE EXCEPTION 'EMAIL_TAKEN';
  END IF;

  -- shu email bilan auth hisob bormi?
  SELECT id INTO v_uid FROM auth.users WHERE email = v_email LIMIT 1;
  IF v_uid IS NULL THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt(p_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_staff.full_name),
      now(), now(), '', '', '', ''
    ) RETURNING id INTO v_uid;
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt(p_password, gen_salt('bf')),
        raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{full_name}', to_jsonb(v_staff.full_name)),
        updated_at = now()
    WHERE id = v_uid;
  END IF;

  UPDATE erp_staff SET user_id = v_uid, email = v_email, updated_at = now() WHERE id = p_staff_id;
  RETURN v_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION erp_admin_can_pass() FROM anon, public;
REVOKE EXECUTE ON FUNCTION erp_staff_import(jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION erp_staff_set_login(uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION erp_admin_can_pass() TO authenticated;
GRANT EXECUTE ON FUNCTION erp_staff_import(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION erp_staff_set_login(uuid, text, text) TO authenticated;
