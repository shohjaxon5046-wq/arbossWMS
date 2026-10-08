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

const fmt = (n: unknown) => Math.round(Number(n) || 0).toLocaleString("ru-RU").replace(/,/g, " ");

async function buildContext(sb: ReturnType<typeof createClient>) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [registers, orders, items, customers, partners, expenses, payments, services] = await Promise.all([
    sb.from("erp_cash_registers").select("name, currency, current_balance, is_active"),
    sb.from("erp_orders").select("order_number, customer_name, customer_phone, status, total_rent_amount, paid_amount, debt_amount, start_date, expected_return_date").order("created_at", { ascending: false }).limit(200),
    sb.from("erp_product_items").select("serial_number, status, erp_product_models(name, daily_price)").limit(1000),
    sb.from("erp_customers").select("full_name, phone_primary, debt, total_orders, status").order("debt", { ascending: false }).limit(200),
    sb.from("erp_service_partners").select("company_name, service_category, phone_primary, status, is_available"),
    sb.from("erp_expenses").select("title, amount, category, date").gte("date", monthStart),
    sb.from("erp_order_payments").select("amount, date").gte("date", monthStart),
    sb.from("erp_service_orders").select("order_number, customer_name, service_category, order_status, customer_total_price, net_profit").order("created_at", { ascending: false }).limit(50),
  ]);

  const regs = registers.data ?? [];
  const ords = orders.data ?? [];
  const its = (items.data ?? []) as Array<{ serial_number: string; status: string; erp_product_models: { name: string; daily_price: number } | null }>;
  const custs = customers.data ?? [];
  const exps = expenses.data ?? [];
  const pays = payments.data ?? [];

  const overdue = ords.filter(o =>
    o.status === "kechikkan" ||
    (o.status === "faol_ijarada" && o.expected_return_date && new Date(o.expected_return_date) < now));
  const active = ords.filter(o => o.status === "faol_ijarada");

  const stock: Record<string, Record<string, number>> = {};
  for (const it of its) {
    const name = it.erp_product_models?.name ?? "?";
    stock[name] ??= {};
    stock[name][it.status] = (stock[name][it.status] ?? 0) + 1;
  }

  const monthRevenue = pays.reduce((s, p) => s + Number(p.amount || 0), 0);
  const monthExpenses = exps.reduce((s, e) => s + Number(e.amount || 0), 0);

  const lines: string[] = [];
  lines.push(`Bugungi sana: ${now.toISOString().slice(0, 10)}`);
  lines.push(`\n## Kassalar`);
  regs.forEach(r => lines.push(`- ${r.name}:${fmt(r.current_balance)} ${r.currency}${r.is_active ? "" : " (nofaol)"}`));
  lines.push(`Jami kassada: ${fmt(regs.reduce((s, r) => s + Number(r.current_balance || 0), 0))}`);
  lines.push(`\n## Shu oy: tushum ${fmt(monthRevenue)}, xarajat ${fmt(monthExpenses)}, sof${fmt(monthRevenue - monthExpenses)}`);
  exps.slice(0, 20).forEach(e => lines.push(`- xarajat: ${e.title} (${e.category}) ${fmt(e.amount)}${String(e.date).slice(0, 10)}`));
  lines.push(`\n## Buyurtmalar (oxirgi ${ords.length}), faol ijarada: ${active.length}, kechikkan:${overdue.length}`);
  overdue.forEach(o => lines.push(`- KECHIKKAN ${o.order_number} ${o.customer_name}${o.customer_phone ?? ""}, qaytarish: ${String(o.expected_return_date).slice(0, 10)}, qarz${fmt(o.debt_amount)}`));
  ords.slice(0, 40).forEach(o => lines.push(`- ${o.order_number} ${o.customer_name} [${o.status}] summa ${fmt(o.total_rent_amount)}, to'langan${fmt(o.paid_amount)}, qarz ${fmt(o.debt_amount)}, qaytarish${o.expected_return_date ? String(o.expected_return_date).slice(0, 10) : "-"}`));
  lines.push(`\n## Ombor (model: holat=soni). Holatlar: omborda_bosh=bo'sh, ijarada, tamirda, yoqolgan, sotildi`);
  Object.entries(stock).forEach(([name, s]) =>
    lines.push(`- ${name}:${Object.entries(s).map(([k, v]) => `${k}=${v}`).join(", ")}`));
  lines.push(`\n## Qarzdor mijozlar`);
  custs.filter(c => Number(c.debt) > 0).slice(0, 30).forEach(c => lines.push(`- ${c.full_name} ${c.phone_primary ?? ""}: qarz ${fmt(c.debt)}`));
  lines.push(`Jami mijozlar: ${custs.length}`);
  lines.push(`\n## Hamkorlar`);
  (partners.data ?? []).forEach(p => lines.push(`- ${p.company_name} (${p.service_category}) ${p.phone_primary ?? ""} [${p.status}]`));
  lines.push(`\n## Xizmat buyurtmalari`);
  (services.data ?? []).slice(0, 20).forEach(s => lines.push(`- ${s.order_number}${s.customer_name} ${s.service_category} [${s.order_status}] narx ${fmt(s.customer_total_price)}, foyda${fmt(s.net_profit)}`));

  return {
    text: lines.join("\n"),
    metadata: { overdue: overdue.length, active: active.length, monthRevenue, monthExpenses },
  };
}

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

    const body = await req.json().catch(() => null);
    const message = typeof body?.message === "string" ? body.message.trim().slice(0, 2000) : "";
    const lang = body?.lang === "ru" ? "ru" : "uz";
    if (!message) return json({ error: "Message is required" }, 400);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return json({
        response: lang === "ru"
          ? "AI-помощник ещё не подключён: не добавлен ключ Gemini API. Добавьте ключ GEMINI_API_KEY в настройках проекта."
          : "AI yordamchi hali ulanmagan: Gemini API kaliti qo'shilmagan. Loyiha sozlamalarida GEMINI_API_KEY kalitini qo'shing.",
        metadata: { configured: false },
      });
    }

    const { data: history } = await sb
      .from("erp_ai_conversations")
      .select("role, content")
      .eq("session_id", userData.user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const ctx = await buildContext(sb);

    const system = `Sen "WMS Arenda ERP" tizimining AI yordamchisisan. Kompaniya qurilish uskunalarini ijaraga beradi, ombor, buyurtmalar, hamkorlar (avtokran, musor, gruzchik) va moliyani boshqaradi.
Faqat quyidagi jonli ma'lumotlarga tayan, raqamlarni o'ylab topma. Ma'lumot yetarli bo'lmasa, shuni ochiq ayt.
Javobni ${lang === "ru" ? "rus tilida" : "o'zbek tilida (lotin)"} ber. Qisqa, aniq, kerak bo'lsa ro'yxat bilan. Pul summalarini so'mda ko'rsat. Markdown belgilarini (**, #) ishlatma.

=== JONLI MA'LUMOTLAR ===
${ctx.text}`;

    const contents = [
      ...(history ?? []).reverse()
        .filter(h => h.content && h.content !== message)
        .map(h => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.content }] })),
      { role: "user", parts: [{ text: message }] },
    ];

    const geminiRes = await fetch(
      `