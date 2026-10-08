/*
# Cleanup: duplicate staff-login helpers (handled by admin-users edge function)

These three SECURITY DEFINER helpers were added tentatively but staff login / import is done
through the `admin-users` edge function (service role, auth.admin). Dropping unused helpers keeps
the execute-grant surface minimal. No data is lost.
*/

DROP FUNCTION IF EXISTS erp_admin_can_pass();
DROP FUNCTION IF EXISTS erp_staff_import(jsonb);
DROP FUNCTION IF EXISTS erp_staff_set_login(uuid, text, text);
