/*
# Lock down order-creation entry points

1. Security changes
- `erp_create_order_core` and `erp_bot_create_order` are internal helpers; the web app uses
  `erp_create_order` and the bot server calls the core directly with its own authorization.
  EXECUTE is revoked from anon AND authenticated on both, so neither can be called through
  the Data API. Only the bot/web functions run them internally.
- `erp_bot_create_order` is additionally revoked from authenticated; only the bot server
  (service role, bypasses grants) reaches it.
*/

REVOKE EXECUTE ON FUNCTION erp_create_order_core(jsonb, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION erp_bot_create_order(jsonb, text) FROM anon, authenticated;
