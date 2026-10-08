import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ROLES = new Set(["admin", "manager", "seller", "cashier", "warehouse"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Row = {
  full_name?: unknown;
  phone?: unknown;
  email?: unknown;
  password?: unknown;
  role?: unknown;
};

const isDuplicate = (message: string) => {
  const msg = message.toLowerCase();
  return (
    msg.includes("already been registered") ||
    msg.includes("already exists") ||
    msg.includes("already registered") ||
    msg.includes("duplicate")
  );
};

const cleanRow = (row: Row) => ({
  full_name: typeof row.full_name === "string" ? row.full_name.trim() : "",
  phone: typeof row.phone === "string" ? row.phone.trim() : "",
  email: typeof row.email === "string" ? row.email.trim().toLowerCase() : "",
  password: typeof row.password === "string" ? row.password : "",
  role: typeof row.role === "string" ? row.role.toLowerCase() : "seller",
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    // Faqat admin xodim ochishi / tahrirlashi mumkin
    const { data: actor } = await sb
      .from("erp_staff")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!actor || actor.role !== "admin") return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => null);
    const action = typeof body?.action === "string" ? body.action : "create";

    // --- Eski xodimga login (email + parol) berish / yangilash ---
    if (action === "set_login") {
      const staffId = typeof body?.staff_id === "string" ? body.staff_id : "";
      const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body?.password === "string" ? body.password : "";

      if (!staffId) return json({ error: "missing_staff" }, 400);
      if (!EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 400);
      if (password.length < 6) return json({ error: "password_too_short" }, 400);

      const { data: staffRow } = await sb.from("erp_staff").select("id, user_id, full_name").eq("id", staffId).maybeSingle();
      if (!staffRow) return json({ error: "missing_staff" }, 404);

      // Boshqa xodim band qilgan email bo'lmasin
      const { data: taken } = await sb.from("erp_staff").select("id").eq("email", email).neq("id", staffId).maybeSingle();
      if (taken) return json({ error: "email_exists" }, 409);

      let userId = staffRow.user_id as string | null;
      if (userId) {
        const { error: updErr } = await sb.auth.admin.updateUserById(userId, {
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: staffRow.full_name },
        });
        if (updErr) {
          return json({ error: isDuplicate(String(updErr.message)) ? "email_exists" : "update_failed" }, 409);
        }
      } else {
        const { data: created, error: createErr } = await sb.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: staffRow.full_name },
        });
        if (createErr || !created.user) {
          return json({ error: isDuplicate(String(createErr?.message)) ? "email_exists" : "create_failed" }, 409);
        }
        userId = created.user.id;
      }

      const { error: staffErr } = await sb.from("erp_staff").update({ user_id: userId, email, updated_at: new Date().toISOString() }).eq("id", staffId);
      if (staffErr) return json({ error: "update_failed" }, 500);

      return json({ ok: true, id: userId });
    }

    // --- Excel / ommaviy xodim qo'shish ---
    if (action === "bulk") {
      const rows = Array.isArray(body?.rows) ? (body.rows as Row[]) : [];
      if (rows.length === 0) return json({ error: "no_rows" }, 400);

      const results: { full_name: string; email: string; error: string | null }[] = [];
      for (const raw of rows) {
        const row = cleanRow(raw);
        if (!row.full_name) continue;

        if (!ROLES.has(row.role)) {
          results.push({ full_name: row.full_name, email: row.email, error: "invalid_role" });
          continue;
        }

        // Login talab qilinsa (email+parol) — to'liq hisob ochamiz; bo'lmasa faqat bot qatori.
        if (row.email) {
          if (!EMAIL_RE.test(row.email)) {
            results.push({ full_name: row.full_name, email: row.email, error: "invalid_email" });
            continue;
          }
          if (row.password.length < 6) {
            results.push({ full_name: row.full_name, email: row.email, error: "password_too_short" });
            continue;
          }
          const { data: created, error: createErr } = await sb.auth.admin.createUser({
            email: row.email,
            password: row.password,
            email_confirm: true,
            user_metadata: { full_name: row.full_name },
          });
          if (createErr || !created.user) {
            results.push({ full_name: row.full_name, email: row.email, error: isDuplicate(String(createErr?.message)) ? "email_exists" : "create_failed" });
            continue;
          }
          const { error: staffErr } = await sb.from("erp_staff").insert({
            user_id: created.user.id,
            full_name: row.full_name,
            phone: row.phone,
            email: row.email,
            role: row.role,
            is_active: true,
          });
          if (staffErr) {
            await sb.auth.admin.deleteUser(created.user.id);
            results.push({ full_name: row.full_name, email: row.email, error: "create_failed" });
            continue;
          }
          results.push({ full_name: row.full_name, email: row.email, error: null });
        } else {
          const { error: staffErr } = await sb.from("erp_staff").insert({
            user_id: null,
            full_name: row.full_name,
            phone: row.phone,
            email: "",
            role: row.role,
            is_active: true,
          });
          results.push({ full_name: row.full_name, email: "", error: staffErr ? "create_failed" : null });
        }
      }

      return json({ ok: true, results });
    }

    // --- Yagona xodim ochish (mavjud oqim) ---
    const fullName = typeof body?.full_name === "string" ? body.full_name.trim() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const role = typeof body?.role === "string" ? body.role : "";

    if (!fullName || !email || !password) return json({ error: "missing_fields" }, 400);
    if (!EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 400);
    if (password.length < 6) return json({ error: "password_too_short" }, 400);
    if (!ROLES.has(role)) return json({ error: "invalid_role" }, 400);

    const { data: created, error: createErr } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createErr) {
      return json({ error: isDuplicate(String(createErr.message)) ? "email_exists" : "create_failed" }, 409);
    }
    if (!created.user) return json({ error: "create_failed" }, 500);

    const { error: staffErr } = await sb.from("erp_staff").insert({
      user_id: created.user.id,
      full_name: fullName,
      phone,
      email,
      role,
      is_active: true,
    });
    if (staffErr) {
      await sb.auth.admin.deleteUser(created.user.id);
      return json({ error: "create_failed" }, 500);
    }

    return json({ ok: true, id: created.user.id });
  } catch (err) {
    console.error("admin-users error:", err);
    return json({ error: "server_error" }, 500);
  }
});
