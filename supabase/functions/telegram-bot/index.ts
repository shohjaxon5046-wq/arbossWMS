import {
  type Actor, type Sb, botToken, esc, findActor, json, log, phoneKey, send, serviceClient, tg, corsHeaders,
} from "./lib.ts";
import {
  customerSearch, dailyEveningReport, debtorsReport, myOrders, myRevenue, overdueReport, putawayList, revenueReport,
  sellerRanking, stockReport, todayPayments,
} from "./reports.ts";
import { handleCallback, notifyOrder, notifyLogisticsOrder, partnerJobs, warehouseQueue } from "./jobs.ts";
import { clearDraft, handleDraftStep, loadDraft, startOrderDraft } from "./draft.ts";

type Staff = Extract<Actor, { type: "staff" }>;
type MenuItem = { text: string; roles: string[]; run: (sb: Sb, a: Actor) => Promise<unknown> };

const ADMIN = ["admin", "manager"];
const SEARCH_ROLES = ["admin", "manager", "seller", "cashier"];
const reply = (fn: (sb: Sb, a: Actor) => Promise<string>) => async (sb: Sb, a: Actor) => send(a.chatId, await fn(sb, a));

const MENU: MenuItem[] = [
  { text: "Bugungi hisobot", roles: ADMIN, run: reply(sb => revenueReport(sb, "day")) },
  { text: "Oylik hisobot", roles: ADMIN, run: reply(sb => revenueReport(sb, "month")) },
  { text: "Mening buyurtmalarim", roles: ["seller"], run: reply((sb, a) => myOrders(sb, a as Staff)) },
  { text: "Mening daromadim", roles: ["seller"], run: reply((sb, a) => myRevenue(sb, a as Staff)) },
  { text: "Bugungi to'lovlar", roles: ["cashier", ...ADMIN], run: reply(sb => todayPayments(sb)) },
  { text: "Qarzdorlar", roles: ["cashier", ...ADMIN], run: reply(sb => debtorsReport(sb)) },
  { text: "Muddati o'tganlar", roles: ADMIN, run: reply(sb => overdueReport(sb)) },
  { text: "Sotuvchilar reytingi", roles: ADMIN, run: reply(sb => sellerRanking(sb)) },
  { text: "Yig'ish kerak", roles: ["warehouse", ...ADMIN], run: (sb, a) => warehouseQueue(sb, a.chatId) },
  { text: "Joylashtirish kutilmoqda", roles: ["warehouse", ...ADMIN], run: reply(sb => putawayList(sb)) },
  { text: "Ombor qoldig'i", roles: ["seller", "warehouse", ...ADMIN], run: reply(sb => stockReport(sb)) },
  { text: "Buyurtma berish", roles: ["seller", ...ADMIN], run: (sb, a) => startOrderDraft(sb, a as Staff) },
  {
    text: "Mijoz qidirish", roles: SEARCH_ROLES,
    run: (_sb, a) => send(a.chatId, "Mijozning telefon raqamini yoki ismini yozing."),
  },
  { text: "Mening zakazlarim", roles: ["partner"], run: (sb, a) => partnerJobs(sb, a as Extract<Actor, { type: "partner" }>) },
];

const roleOf = (a: Actor) => (a.type === "partner" ? "partner" : a.role);

function keyboardFor(a: Actor) {
  const items = MENU.filter(m => m.roles.includes(roleOf(a))).map(m => ({ text: m.text }));
  const rows: { text: string }[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  rows.push([{ text: "Chiqish" }]);
  return { reply_markup: { keyboard: rows, resize_keyboard: true, is_persistent: true } };
}

const ROLE_NAME: Record<string, string> = {
  admin: "Administrator", manager: "Menejer", seller: "Sotuvchi", cashier: "Kassir", warehouse: "Omborchi", partner: "Hamkor",
};

const showMenu = (a: Actor) =>
  send(a.chatId, `Salom, <b>${esc(a.name)}</b>!\nLavozim: ${ROLE_NAME[roleOf(a)] ?? roleOf(a)}\n\nKerakli bo'limni tanlang.`, keyboardFor(a));

const askContact = (chatId: string) =>
  send(chatId, "Assalomu alaykum! Kirish uchun pastdagi tugma orqali telefon raqamingizni yuboring.", {
    reply_markup: {
      keyboard: [[{ text: "Telefon raqamni yuborish", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });

async function unlinkChat(sb: Sb, chatId: string) {
  await sb.from("erp_staff").update({ telegram_chat_id: null }).eq("telegram_chat_id", chatId);
  await sb.from("erp_service_partners").update({ telegram_chat_id: null }).eq("telegram_chat_id", chatId);
}

async function loginByContact(sb: Sb, chatId: string, phone: string) {
  const key = phoneKey(phone);
  if (key.length < 9) return send(chatId, "Telefon raqami noto'g'ri.");
  const { data: staff } = await sb.from("erp_staff").select("id, phone, is_active").not("phone", "is", null);
  const st = (staff ?? []).find(s => phoneKey(s.phone) === key);
  if (st && !st.is_active) {
    await log(sb, chatId, null, "login_denied", { reason: "inactive", phone_tail: key.slice(-4) });
    return send(chatId, "Hisobingiz faol emas. Administratorga murojaat qiling.", { reply_markup: { remove_keyboard: true } });
  }
  let target: { table: "erp_staff" | "erp_service_partners"; id: string } | null = st ? { table: "erp_staff", id: st.id } : null;
  if (!target) {
    const { data: partners } = await sb.from("erp_service_partners").select("id, phone_primary, phone_secondary");
    const p = (partners ?? []).find(x => phoneKey(x.phone_primary) === key || phoneKey(x.phone_secondary) === key);
    if (p) target = { table: "erp_service_partners", id: p.id };
  }
  if (!target) {
    await log(sb, chatId, null, "login_denied", { reason: "unknown", phone_tail: key.slice(-4) });
    return send(chatId, "Bu raqam tizimda topilmadi. Administratorga murojaat qiling.", { reply_markup: { remove_keyboard: true } });
  }
  await unlinkChat(sb, chatId);
  await sb.from(target.table).update({ telegram_chat_id: chatId }).eq("id", target.id);
  const actor = await findActor(sb, chatId);
  if (!actor) return send(chatId, "Kirishda xatolik. Qayta urinib ko'ring: /start");
  await log(sb, chatId, actor, "login");
  return showMenu(actor);
}

type Msg = {
  chat: { id: number; type: string };
  from?: { id: number };
  text?: string;
  contact?: { phone_number: string; user_id?: number };
};

async function handleMessage(sb: Sb, msg: Msg) {
  if (msg.chat.type !== "private") return;
  const chatId = String(msg.chat.id);
  if (msg.contact) {
    if (!msg.from || msg.contact.user_id !== msg.from.id) return send(chatId, "Faqat o'zingizning raqamingizni yuboring.");
    return loginByContact(sb, chatId, msg.contact.phone_number);
  }
  const actor = await findActor(sb, chatId);
  if (!actor) return askContact(chatId);
  const text = (msg.text ?? "").trim();
  if (!text || text === "/start" || text === "/menu") return showMenu(actor);
  if (text === "Chiqish") {
    await log(sb, chatId, actor, "logout");
    await unlinkChat(sb, chatId);
    await clearDraft(sb, chatId);
    return send(chatId, "Siz tizimdan chiqdingiz. Qayta kirish: /start", { reply_markup: { remove_keyboard: true } });
  }
  const role = roleOf(actor);
  const item = MENU.find(m => m.text === text);
  if (item) {
    if (!item.roles.includes(role)) return send(chatId, "Bu bo'lim sizning lavozimingiz uchun yopiq.");
    await log(sb, chatId, actor, "menu", { item: item.text });
    return item.run(sb, actor);
  }
  if (actor.type === "staff") {
    const draft = await loadDraft(sb, chatId);
    if (draft) {
      const handled = await handleDraftStep(sb, actor, text);
      if (handled) return;
    }
  }
  if (SEARCH_ROLES.includes(role)) {
    await log(sb, chatId, actor, "customer_search", { query: text.slice(0, 40) });
    return send(chatId, await customerSearch(sb, text.slice(0, 60)));
  }
  return send(chatId, "Pastdagi tugmalardan foydalaning.", keyboardFor(actor));
}

async function staffFromJwt(sb: Sb, req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data } = await sb.auth.getUser(token);
  if (!data?.user) return null;
  const { data: st } = await sb.from("erp_staff").select("id, user_id, full_name, role, phone")
    .eq("user_id", data.user.id).eq("is_active", true).maybeSingle();
  if (!st) return null;
  return { type: "staff", id: st.id, userId: st.user_id, name: st.full_name, role: st.role, phone: st.phone, chatId: "web" } as Staff;
}

async function getConfig(sb: Sb) {
  const { data, error } = await sb.from("erp_bot_config").select("*").eq("id", 1).maybeSingle();
  if (error || !data) throw new Error("Bot config missing");
  return data as { webhook_secret: string; cron_secret: string; function_url: string | null; bot_username: string | null; connected_at: string | null };
}

async function setup(sb: Sb) {
  if (!botToken()) return json({ ok: false, error: "TOKEN_MISSING" });
  const me = await tg("getMe", {});
  if (!me.ok) return json({ ok: false, error: "TOKEN_INVALID" });
  const cfg = await getConfig(sb);
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram-bot`;
  const hook = await tg("setWebhook", {
    url, secret_token: cfg.webhook_secret, allowed_updates: ["message", "callback_query"], drop_pending_updates: true,
  });
  if (!hook.ok) return json({ ok: false, error: "WEBHOOK_FAILED", detail: hook.description });
  await tg("setMyCommands", { commands: [{ command: "start", description: "Kirish / Menyu" }, { command: "menu", description: "Menyu" }] });
  const username = String(me.result?.username ?? "");
  await sb.from("erp_bot_config").update({
    function_url: url, bot_username: username, connected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", 1);
  return json({ ok: true, username });
}

async function status(sb: Sb) {
  const cfg = await getConfig(sb);
  const [{ count: staffLinked }, { count: partnersLinked }, { count: staffTotal }] = await Promise.all([
    sb.from("erp_staff").select("id", { count: "exact", head: true }).not("telegram_chat_id", "is", null).eq("is_active", true),
    sb.from("erp_service_partners").select("id", { count: "exact", head: true }).not("telegram_chat_id", "is", null),
    sb.from("erp_staff").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);
  return json({
    ok: true,
    tokenConfigured: !!botToken(),
    connected: !!cfg.connected_at,
    username: cfg.bot_username,
    staffLinked: staffLinked ?? 0,
    staffTotal: staffTotal ?? 0,
    partnersLinked: partnersLinked ?? 0,
  });
}

async function dailyReport(sb: Sb) {
  const text = await dailyEveningReport(sb);
  const { data } = await sb.from("erp_staff").select("telegram_chat_id").in("role", ADMIN).eq("is_active", true)
    .not("telegram_chat_id", "is", null);
  for (const s of data ?? []) await send(s.telegram_chat_id, text);
  await log(sb, "cron", null, "daily_report", { recipients: data?.length ?? 0 });
  return json({ ok: true });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const sb = serviceClient();

  const tgSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (tgSecret !== null) {
    try {
      const cfg = await getConfig(sb);
      if (tgSecret !== cfg.webhook_secret) return json({ ok: false }, 401);
      const update = await req.json();
      if (update.callback_query) {
        const cb = update.callback_query;
        const actor = await findActor(sb, String(cb.message?.chat?.id ?? cb.from?.id ?? ""));
        await handleCallback(sb, cb, actor);
      } else if (update.message) {
        await handleMessage(sb, update.message);
      }
    } catch (err) {
      console.error("update error", err);
    }
    return json({ ok: true });
  }

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "daily_report") {
      const cfg = await getConfig(sb);
      if (req.headers.get("x-cron-secret") !== cfg.cron_secret) return json({ error: "Unauthorized" }, 401);
      return await dailyReport(sb);
    }

    const staff = await staffFromJwt(sb, req);
    if (!staff) return json({ error: "Unauthorized" }, 401);

    if (action === "notify_order") {
      if (typeof body.order_id !== "string" || !UUID.test(body.order_id)) return json({ error: "Invalid order" }, 400);
      if (!botToken()) return json({ ok: true, sent: 0 });
      return json({ ok: true, ...(await notifyOrder(sb, body.order_id, staff)) });
    }
    if (action === "notify_logistics_order") {
      if (typeof body.order_id !== "string" || !UUID.test(body.order_id)) return json({ error: "Invalid order" }, 400);
      if (!botToken()) return json({ ok: true, sent: 0 });
      return json({ ok: true, ...(await notifyLogisticsOrder(sb, body.order_id)) });
    }
    if (!ADMIN.includes(staff.role)) return json({ error: "Forbidden" }, 403);
    if (action === "status") return await status(sb);
    if (action === "setup") {
      if (staff.role !== "admin") return json({ error: "Forbidden" }, 403);
      const res = await setup(sb);
      await log(sb, "web", staff, "bot_setup");
      return res;
    }
    if (action === "test_report") return await dailyReport(sb);
    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: "Internal error" }, 500);
  }
});
