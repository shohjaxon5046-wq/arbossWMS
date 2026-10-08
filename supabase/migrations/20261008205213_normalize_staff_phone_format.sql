/*
# Normalize staff phone numbers to +998 format

1. Changes
- Any staff phone stored as exactly 9 digits (no country code) is rewritten to the full
  `+998` form so Telegram login (which compares on normalized digits) can match it.
- Any phone stored with the 998 country code but missing the leading `+` is rewritten to
  `+998...`.
- Phones already in canonical `+998` 12-digit form are left untouched.

2. Notes
- Non-destructive data cleanup only: no rows are deleted, only phone formatting is fixed.
*/

UPDATE erp_staff
SET phone = '+' || regexp_replace(COALESCE(phone,''), '\D', '', 'g'),
    updated_at = now()
WHERE phone IS NOT NULL
  AND btrim(phone) <> ''
  AND length(regexp_replace(COALESCE(phone,''), '\D', '', 'g')) = 9
  AND regexp_replace(COALESCE(phone,''), '\D', '', 'g') NOT LIKE '998%';

UPDATE erp_staff
SET phone = '+' || regexp_replace(COALESCE(phone,''), '\D', '', 'g'),
    updated_at = now()
WHERE phone IS NOT NULL
  AND btrim(phone) <> ''
  AND length(regexp_replace(COALESCE(phone,''), '\D', '', 'g')) = 12
  AND regexp_replace(COALESCE(phone,''), '\D', '', 'g') LIKE '998%'
  AND phone NOT LIKE '+%';
