/*
# Allow signed-in staff to draw order numbers

1. Security
- Grants USAGE on `erp_order_number_seq` to authenticated so `erp_create_order` (security invoker) can call nextval.
*/
GRANT USAGE, SELECT ON SEQUENCE erp_order_number_seq TO authenticated;
