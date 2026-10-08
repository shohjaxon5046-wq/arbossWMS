import { type Actor, type Sb, esc, fetchAll, fmtDate, money, ORDER_STATUS, phoneKey, tashkentStart } from "./lib.ts";

const PAY_TYPE: Record<string, string> = { naqd: "Naqd", plastik: "Karta", "o'tkazma": "O'tkazma" };
const OPEN = ["yangi", "yigilmoqda", "faol_ijarada", "kechikkan"];

type OrderRow = {
  order_number: string;
  total_rent_amount: number;
  total_service_amount: number;
  paid_amount: number;
  debt_amount: number;
  created_by: string | null;
  created_by_user_id: string | null;
};

async function ordersSince(sb: Sb, since: string, userId?: string | null) {
  return await fetchAll<OrderRow>((a, b) => {
    let q = sb
      .from("erp_orders")
      .select("order_number, total_rent_amount, total_service_amount, paid_amount, debt_amount, created_by, created_by_user_id")
      .gte("created_at", since)
      .neq("status", "bekor");
    if (userId) q = q.eq("created_by_user_id", userId);
    return q.range(a, b);
  });
}

async function paymentsSince(sb: Sb, since: string) {
  return await fetchAll<{ amount: number; payment_type: string | null }>((a, b) =>
    sb.from("erp_order_payments").select("amount, payment_type").gte("date", since).range(a, b)
  );
}

const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + (Number(f(r)) || 0), 0);
const orderValue = (o: OrderRow) => Number(o.total_rent_amount) + Number(o.total_service_amount);

async function periodBlock(sb: Sb, kind: "day" | "month") {
  const since = tashkentStart(kind);
  const [orders, pays] = await Promise.all([ordersSince(sb, since), paymentsSince(sb, since)]);
  const byType = new Map<string, number>();
  for (const p of pays) {
    const k = PAY_TYPE[p.payment_type ?? ""] ?? (p.payment_type || "Boshqa");
    byType.set(k, (byType.get(k) ?? 0) + Number(p.amount));
  }
  const lines = [
    `Yangi buyurtmalar: <b>${orders.length}</b> ta`,
    `Buyurtmalar summasi: <b>${money(sum(orders, orderValue))}</b>`,
    `Tushgan pul: <b>${money(sum(pays, p => p.amount))}</b>`,
  ];
  for (const [k, v] of byType) lines.push(`  • ${esc(k)}: ${money(v)}`);
  return lines.join("\n");
}

export async function revenueReport(sb: Sb, kind: "day" | "month") {
  const title = kind === "day" ? `Bugungi hisobot (${fmtDate(new Date().toISOString())})` : "Shu oy hisoboti";
  return `<b>${title}</b>\n\n${await periodBlock(sb, kind)}`;
}

export async function dailyEveningReport(sb: Sb) {
  const [today, overdue, debt] = await Promise.all([periodBlock(sb, "day"), overdueCount(sb), totalDebt(sb)]);
  return [
    `<b>Kunlik hisobot — ${fmtDate(new Date().toISOString())}</b>`,
    "",
    today,
    "",
    `Muddati o'tgan buyurtmalar: <b>${overdue}</b> ta`,
    `Mijozlarning umumiy qarzi: <b>${money(debt)}</b>`,
  ].join("\n");
}

async function totalDebt(sb: Sb) {
  const rows = await fetchAll<{ debt: number }>((a, b) => sb.from("erp_customers").select("debt").gt("debt", 0).range(a, b));
  return sum(rows, r => r.debt);
}

async function overdueCount(sb: Sb) {
  const { count } = await sb
    .from("erp_orders")
    .select("id", { count: "exact", head: true })
    .or(`status.eq.kechikkan,and(status.eq.faol_ijarada,expected_return_date.lt.${new Date().toISOString()})`);
  return count ?? 0;
}

export async function debtorsReport(sb: Sb) {
  const { data, error } = await sb
    .from("erp_customers")
    .select("full_name, phone_primary, debt")
    .gt("debt", 0)
    .order("debt", { ascending: false })
    .limit(15);
  if (error) throw error;
  if (!data?.length) return "Qarzdor mijozlar yo'q.";
  const total = await totalDebt(sb);
  const rows = data.map((c, i) => `${i + 1}. ${esc(c.full_name)} — <b>${money(c.debt)}</b>\n    ${esc(c.phone_primary ?? "")}`);
  return `<b>Qarzdorlar</b> (jami ${money(total)})\n\n${rows.join("\n")}`;
}

export async function overdueReport(sb: Sb) {
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("erp_orders")
    .select("order_number, customer_name, customer_phone, expected_return_date, debt_amount")
    .or(`status.eq.kechikkan,and(status.eq.faol_ijarada,expected_return_date.lt.${now})`)
    .order("expected_return_date", { ascending: true })
    .limit(20);
  if (error) throw error;
  if (!data?.length) return "Muddati o'tgan buyurtmalar yo'q.";
  const rows = data.map(o => {
    const days = Math.max(1, Math.floor((Date.now() - new Date(o.expected_return_date).getTime()) / 86400000));
    return `• <b>${esc(o.order_number)}</b> — ${esc(o.customer_name)} ${esc(o.customer_phone ?? "")}\n   ${days} kun kechikdi, qarz: ${money(o.debt_amount)}`;
  });
  return `<b>Muddati o'tganlar</b>\n\n${rows.join("\n")}`;
}

export async function sellerRanking(sb: Sb) {
  const orders = await ordersSince(sb, tashkentStart("month"));
  const { data: staff } = await sb.from("erp_staff").select("user_id, full_name");
  const names = new Map((staff ?? []).map(s => [s.user_id, s.full_name]));
  const agg = new Map<string, { name: string; count: number; value: number }>();
  for (const o of orders) {
    const key = o.created_by_user_id ?? o.created_by ?? "—";
    const name = (o.created_by_user_id && names.get(o.created_by_user_id)) || o.created_by || "Noma'lum";
    const cur = agg.get(key) ?? { name, count: 0, value: 0 };
    cur.count += 1;
    cur.value += orderValue(o);
    agg.set(key, cur);
  }
  const list = [...agg.values()].sort((a, b) => b.value - a.value);
  if (!list.length) return "Shu oyda buyurtmalar yo'q.";
  return `<b>Sotuvchilar reytingi (shu oy)</b>\n\n${
    list.map((s, i) => `${i + 1}. ${esc(s.name)} — ${s.count} ta, <b>${money(s.value)}</b>`).join("\n")
  }`;
}

export async function myOrders(sb: Sb, actor: Extract<Actor, { type: "staff" }>) {
  if (!actor.userId) return "Hisobingiz tizim foydalanuvchisiga bog'lanmagan.";
  const { data, error } = await sb
    .from("erp_orders")
    .select("order_number, customer_name, status, debt_amount, expected_return_date")
    .eq("created_by_user_id", actor.userId)
    .in("status", OPEN)
    .order("created_at", { ascending: false })
    .limit(15);
  if (error) throw error;
  if (!data?.length) return "Sizda ochiq buyurtmalar yo'q.";
  const rows = data.map(o =>
    `• <b>${esc(o.order_number)}</b> — ${esc(o.customer_name)}\n   ${ORDER_STATUS[o.status] ?? o.status}, qaytish: ${fmtDate(o.expected_return_date)}, qarz: ${money(o.debt_amount)}`
  );
  return `<b>Mening ochiq buyurtmalarim</b>\n\n${rows.join("\n")}`;
}

export async function myRevenue(sb: Sb, actor: Extract<Actor, { type: "staff" }>) {
  if (!actor.userId) return "Hisobingiz tizim foydalanuvchisiga bog'lanmagan.";
  const [day, month] = await Promise.all([
    ordersSince(sb, tashkentStart("day"), actor.userId),
    ordersSince(sb, tashkentStart("month"), actor.userId),
  ]);
  const block = (title: string, rows: OrderRow[]) =>
    `<b>${title}</b>\nBuyurtmalar: ${rows.length} ta\nSumma: <b>${money(sum(rows, orderValue))}</b>\nTo'langan: ${money(sum(rows, r => r.paid_amount))}\nQarz: ${money(sum(rows, r => r.debt_amount))}`;
  return `${block("Bugun", day)}\n\n${block("Shu oy", month)}`;
}

export async function stockReport(sb: Sb) {
  const [{ data: models, error }, items] = await Promise.all([
    sb.from("erp_product_models").select("id, name, daily_price").eq("is_active", true).order("name"),
    fetchAll<{ model_id: string; status: string }>((a, b) => sb.from("erp_product_items").select("model_id, status").range(a, b)),
  ]);
  if (error) throw error;
  const free = new Map<string, number>();
  const total = new Map<string, number>();
  for (const it of items) {
    if (["sotildi", "yoqolgan"].includes(it.status)) continue;
    total.set(it.model_id, (total.get(it.model_id) ?? 0) + 1);
    if (it.status === "omborda_bosh") free.set(it.model_id, (free.get(it.model_id) ?? 0) + 1);
  }
  const rows = (models ?? [])
    .filter(m => total.get(m.id))
    .map(m => `• ${esc(m.name)} — bo'sh <b>${free.get(m.id) ?? 0}</b> / ${total.get(m.id)} (${money(m.daily_price)}/kun)`);
  if (!rows.length) return "Omborda uskunalar yo'q.";
  return `<b>Ombor qoldig'i</b>\n\n${rows.slice(0, 60).join("\n")}`;
}

export async function customerSearch(sb: Sb, query: string) {
  const digits = phoneKey(query);
  let list: { id: string; full_name: string; phone_primary: string | null; phone_secondary: string | null; debt: number; total_orders: number }[] = [];
  const cols = "id, full_name, phone_primary, phone_secondary, debt, total_orders";
  if (digits.length >= 7) {
    const tail = digits.slice(-4);
    const { data } = await sb.from("erp_customers").select(cols)
      .or(`phone_primary.ilike.%${tail}%,phone_secondary.ilike.%${tail}%`).limit(200);
    list = (data ?? []).filter(c => phoneKey(c.phone_primary).endsWith(digits) || phoneKey(c.phone_secondary).endsWith(digits));
  } else {
    const safe = query.replace(/[%,()*\\]/g, " ").trim();
    if (safe.length < 3) return "Kamida 3 ta harf yoki telefon raqamini yozing.";
    const { data } = await sb.from("erp_customers").select(cols).ilike("full_name", `%${safe}%`).limit(10);
    list = data ?? [];
  }
  if (!list.length) return "Mijoz topilmadi.";
  const out: string[] = [];
  for (const c of list.slice(0, 5)) {
    const { data: open } = await sb.from("erp_orders").select("order_number, status, expected_return_date")
      .eq("customer_id", c.id).in("status", OPEN).limit(5);
    out.push([
      `<b>${esc(c.full_name)}</b>`,
      `Tel: ${esc(c.phone_primary ?? "—")}${c.phone_secondary ? `, ${esc(c.phone_secondary)}` : ""}`,
      `Qarz: <b>${money(c.debt)}</b> · Jami buyurtmalar: ${c.total_orders ?? 0}`,
      ...(open ?? []).map(o => `  • ${esc(o.order_number)} — ${ORDER_STATUS[o.status] ?? o.status}, qaytish ${fmtDate(o.expected_return_date)}`),
    ].join("\n"));
  }
  return out.join("\n\n");
}

export async function todayPayments(sb: Sb) {
  const { data, error } = await sb
    .from("erp_order_payments")
    .select("amount, payment_type, date, erp_orders(order_number, customer_name)")
    .gte("date", tashkentStart("day"))
    .order("date", { ascending: false })
    .limit(25);
  if (error) throw error;
  const head = await periodBlock(sb, "day");
  if (!data?.length) return `<b>Bugungi to'lovlar</b>\n\n${head}\n\nBugun to'lov bo'lmadi.`;
  const rows = data.map(p => {
    const o = p.erp_orders as unknown as { order_number?: string; customer_name?: string } | null;
    return `• ${money(p.amount)} — ${PAY_TYPE[p.payment_type ?? ""] ?? esc(p.payment_type ?? "")} · ${esc(o?.order_number ?? "")} ${esc(o?.customer_name ?? "")}`;
  });
  return `<b>Bugungi to'lovlar</b>\n\n${head}\n\n${rows.join("\n")}`;
}

export async function putawayList(sb: Sb) {
  const { data, error } = await sb
    .from("erp_product_items")
    .select("serial_number, erp_product_models(name)")
    .eq("status", "joylashtirish_kutilmoqda")
    .order("created_at", { ascending: true })
    .limit(40);
  if (error) throw error;
  if (!data?.length) return "Joylashtirishni kutayotgan uskunalar yo'q.";
  const rows = data.map(i => {
    const m = i.erp_product_models as unknown as { name?: string } | null;
    return `• ${esc(m?.name ?? "")} — <code>${esc(i.serial_number)}</code>`;
  });
  return `<b>Polkaga joylashtirish kutilmoqda (${data.length})</b>\n\n${rows.join("\n")}`;
}
