/*
# Fix 9-digit national numbers to +998 prefix

1. Changes
- A staff phone stored as a bare 9-digit national number was being converted with a `+`
  instead of the `+998` country prefix. This rewrites any remaining `+9...` (12-char string
  that is a `+` followed by a national number) into the canonical `+998` form.

2. Notes
- Corrective cleanup only; no data is deleted.
*/

UPDATE erp_staff
SET phone = '+998' || substr(btrim(phone), 2),
    updated_at = now()
WHERE phone LIKE '+%'
  AND length(btrim(phone)) = 10
  AND btrim(phone) NOT LIKE '+998%';
