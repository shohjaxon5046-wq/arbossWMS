/*
# Remove PUBLIC execute grants on internal order functions

1. Security changes
- The default PUBLIC execute grant on `erp_create_order_core` and `erp_bot_create_order`
  is revoked, so neither is callable through the Data API by any web role. The bot server
  still reaches them via its service role grant. `erp_create_order` keeps its authenticated
  grant for the web app.
*/

REVOKE EXECUTE ON FUNCTION erp_create_order_core(jsonb, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION erp_bot_create_order(jsonb, text) FROM PUBLIC;
