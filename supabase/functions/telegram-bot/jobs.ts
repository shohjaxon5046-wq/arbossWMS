import {
  type Actor, type Button, type Sb, esc, fmtDate, inline, log, money, ORDER_STATUS, send, SERVICE_CATEGORY,
  SERVICE_STATUS, tg,
} from "./lib.ts";

const ORDER_NEXT: Record<string, { code: string; to: string; from: string[]; label: string }> = {
  y: { code: "y", to: "yigilmoqda", from: ["yangi"], label: "Yig'ildi" },
  b: { code: "b", to: "faol_ijarada", from: ["yangi", "yigilmoqda"], label: "Berildi" },
};

const SERVICE_NEXT: Record<string, { to: string; from: string[]; label: string }> = {
  a: { to: "hamkor_qabul_qildi", from: ["yangi"], label: "Qabul qildim" },
  y: { to: "hamkor_yolda", from: ["yangi", "hamkor_qabul_qildi"], label: "Yo'ldaman" },
  j: { to: "bajarilmoqda", from: ["hamkor_qabul_qildi", "hamkor_yolda"], label: "Bajaryapman" },
  d: { to: "bajarildi", from: ["hamkor_qabul_qildi", "hamkor_yolda", "bajarilmoqda"], label: "Bajarildi" },
};

const WAREHOUSE_ROLES = ["warehouse", "admin", "manager"];

function orderButtons(orderId: string, status: string): Button[][] {
  const row = Object.values(ORDER_NEXT)
    .filter(n => n.from.includes(status))
    .map(n => ({ text: n.label, callback_data: `o:${orderId}:${n.code}` }));
  return row.length ? [row] : [];
}

function serviceButtons(serviceId: string, status: string): Button[][] {
  const next = Object.entries(SERVICE_NEXT).find(([, n]) => n.from.includes(status));
  return next ? [[{ text: next[1].label, callback_data: `s:${serviceId}:${next[0]}` }]] : [];
}

export async function orderCard(sb: Sb, orderId: string) {
  const { data: o } = await sb
    .from("erp_orders")
    .select("id, order_number, customer_name, status, delivery_type, delivery_address, expected_return_date, notes")
    .eq("id", orderId)
    .maybeSingle();
  if (!o) return null;
  const { data: lines } = await sb
    .from("erp_order_items")
    .select("model_name, serial_number, product_item_id, erp_product_items(warehouse_location_shelf)")
    .eq("order_id", orderId);
  const items = (lines ?? []).map(l => {
    const shelf = (l.erp_product_items as unknown as { warehouse_location_shelf?: string } | null)?.warehouse_location_shelf;
    return `• ${esc(l.model_name)}\n   Seriya: <code>${esc(l.serial_number)}</code> · Polka: <b>${esc(shelf || "—")}</b>`;
  });
  const text = [
    `<b>Buyurtma ${esc(o.order_number)}</b> — ${ORDER_STATUS[o.status] ?? o.status}`,
    `Mijoz: ${esc(o.customer_name)}`,
    o.delivery_type === "delivery" ? `Yetkazib berish: ${esc(o.delivery_address || "—")}` : "Olib ketish: ombordan",
    `Qaytish sanasi: ${fmtDate(o.expected_return_date)}`,
    o.notes ? `Izoh: ${esc(o.notes)}` : "",
    "",
    items.length ? `<b>Uskunalar (${items.length}):</b>\n${items.join("\n")}` : "Uskunalar yo'q (faqat xizmatlar).",
  ].filter(Boolean).join("\n");
  return { text, buttons: orderButtons(o.id, o.status), status: o.status, hasItems: items.length > 0 };
}

export async function serviceCard(sb: Sb, serviceId: string) {
  const { data: s } = await sb
    .from("erp_service_orders")
    .select("id, order_id, service_category, order_status, address, scheduled_time, assigned_partner_id")
    .eq("id", serviceId)
    .maybeSingle();
  if (!s) return null;
  let orderNo = "";
  let seller = "—";
  if (s.order_id) {
    const { data: o } = await sb.from("erp_orders").select("order_number, created_by, created_by_user_id").eq("id", s.order_id).maybeSingle();
    orderNo = o?.order_number ?? "";
    if (o?.created_by_user_id) {
      const { data: st } = await sb.from("erp_staff").select("full_name, phone").eq("user_id", o.created_by_user_id).maybeSingle();
      if (st) seller = `${st.full_name}${st.phone ? `, ${st.phone}` : ""}`;
    } else if (o?.created_by) seller = o.created_by;
  }
  const text = [
    `<b>${esc(SERVICE_CATEGORY[s.service_category] ?? s.service_category)}</b>${orderNo ? ` · ${esc(orderNo)}` : ""}`,
    `Holat: ${SERVICE_STATUS[s.order_status] ?? s.order_status}`,
    `Manzil: ${esc(s.address || "—")}`,
    `Vaqt: ${esc(s.scheduled_time || "—")}`,
    `Sotuvchi: ${esc(seller)}`,
  ].join("\n");
  return { text, buttons: serviceButtons(s.id, s.order_status), partnerId: s.assigned_partner_id as string | null };
}

export async function notifyOrder(sb: Sb, orderId: string, by: Actor) {
  const { count } = await sb.from("erp_bot_log").select("id", { count: "exact", head: true })
    .eq("action", "notify_order").eq("details->>order_id", orderId);
  if (count) return { sent: 0, skipped: true };

  let sent = 0;
  const card = await orderCard(sb, orderId);
  if (!card) return { sent: 0 };
  if (card.hasItems) {
    const { data: wh } = await sb.from("erp_staff").select("telegram_chat_id")
      .eq("role", "warehouse").eq("is_active", true).not("telegram_chat_id", "is", null);
    for (const w of wh ?? []) {
      const r = await send(w.telegram_chat_id, `Yangi buyurtma!\n\n${card.text}`, inline(card.buttons));
      if (r.ok) sent++;
    }
  }
  const { data: svcs } = await sb.from("erp_service_orders").select("id").eq("order_id", orderId)
    .not("assigned_partner_id", "is", null);
  for (const s of svcs ?? []) if (await notifyService(sb, s.id)) sent++;

  await log(sb, by.chatId, by, "notify_order", { order_id: orderId, sent });
  return { sent };
}

async function notifyService(sb: Sb, serviceId: string) {
  const card = await serviceCard(sb, serviceId);
  if (!card?.partnerId) return false;
  const { data: p } = await sb.from("erp_service_partners").select("telegram_chat_id").eq("id", card.partnerId).maybeSingle();
  if (!p?.telegram_chat_id) return false;
  const r = await send(p.telegram_chat_id, `Sizga yangi buyurtma!\n\n${card.text}`, inline(card.buttons));
  return r.ok;
}

const LOGISTICS_SERVICE: Record<string, string> = {
  gruzchik: "Gruzchik",
  kran: "Kran va texnika",
  musir: "Musir (chiqindi olib ketish)",
};

const LOGISTICS_STATUS: Record<string, string> = {
  yangi: "Yangi",
  jarayonda: "Jarayonda",
  bajarildi: "Bajarildi",
  bekor: "Bekor qilingan",
};

export async function notifyLogisticsOrder(sb: Sb, orderId: string) {
  const { data: o } = await sb.from("logistics_orders")
    .select("id, order_number, service, customer_name, customer_phone, address, datetime, note, estimated_price, seller_name")
    .eq("id", orderId)
    .maybeSingle();
  if (!o) return { sent: 0 };

  const text = [
    `<b>Yangi logistika buyurtmasi ${esc(o.order_number)}</b>`,
    `Xizmat: ${LOGISTICS_SERVICE[o.service] ?? o.service}`,
    `Mijoz: ${esc(o.customer_name)}`,
    o.customer_phone ? `Tel: ${esc(o.customer_phone)}` : "",
    `Manzil: ${esc(o.address || "—")}`,
    o.datetime ? `Vaqt: ${fmtDate(o.datetime)}` : "",
    o.note ? `Izoh: ${esc(o.note)}` : "",
    `Narx: <b>${money(o.estimated_price)}</b>`,
    `Sotuvchi: ${esc(o.seller_name || "—")}`,
  ].filter(Boolean).join("\n");

  const { data: admins } = await sb.from("erp_staff").select("telegram_chat_id")
    .in("role", ["admin", "manager"]).eq("is_active", true).not("telegram_chat_id", "is", null);
  let sent = 0;
  for (const a of admins ?? []) {
    const r = await send(a.telegram_chat_id, `Yangi logistika buyurtmasi!\n\n${text}`);
    if (r.ok) sent++;
  }
  await log(sb, "web", null, "notify_logistics_order", { order_id: orderId, sent });
  return { sent };
}

export async function warehouseQueue(sb: Sb, chatId: string) {
  const { data } = await sb.from("erp_orders").select("id").in("status", ["yangi", "yigilmoqda"])
    .order("created_at", { ascending: true }).limit(10);
  if (!data?.length) return send(chatId, "Yig'ish kerak bo'lgan buyurtmalar yo'q.");
  for (const o of data) {
    const card = await orderCard(sb, o.id);
    if (card?.hasItems) await send(chatId, card.text, inline(card.buttons));
  }
}

export async function partnerJobs(sb: Sb, actor: Extract<Actor, { type: "partner" }>) {
  const { data } = await sb.from("erp_service_orders").select("id").eq("assigned_partner_id", actor.id)
    .not("order_status", "in", "(bajarildi,bekor)").order("created_at", { ascending: true }).limit(10);
  if (!data?.length) return send(actor.chatId, "Sizda ochiq buyurtmalar yo'q.");
  for (const s of data) {
    const card = await serviceCard(sb, s.id);
    if (card) await send(actor.chatId, card.text, inline(card.buttons));
  }
}

type Callback = { id: string; data?: string; message?: { message_id: number; chat: { id: number } } };

export async function handleCallback(sb: Sb, cb: Callback, actor: Actor | null) {
  const answer = (text: string) => tg("answerCallbackQuery", { callback_query_id: cb.id, text, show_alert: false });
  const chatId = String(cb.message?.chat.id ?? "");
  if (!actor) return answer("Avval telefon raqamingiz bilan kiring: /start");
  const [kind, id, code] = (cb.data ?? "").split(":");
  const edit = (text: string, buttons: Button[][]) =>
    cb.message && tg("editMessageText", {
      chat_id: chatId, message_id: cb.message.message_id, text, parse_mode: "HTML", ...inline(buttons),
    });

  if (kind === "o") {
    const step = ORDER_NEXT[code];
    if (!step || actor.type !== "staff" || !WAREHOUSE_ROLES.includes(actor.role)) return answer("Sizda bu amal uchun ruxsat yo'q.");
    const { data: upd } = await sb.from("erp_orders").update({ status: step.to, updated_at: new Date().toISOString() })
      .eq("id", id).in("status", step.from).select("id");
    if (!upd?.length) {
      const card = await orderCard(sb, id);
      if (card) await edit(card.text, card.buttons);
      return answer("Holat allaqachon o'zgargan.");
    }
    await log(sb, chatId, actor, "order_status", { order_id: id, status: step.to });
    const card = await orderCard(sb, id);
    if (card) await edit(`${card.text}\n\n<i>${esc(actor.name)}: ${step.label}</i>`, card.buttons);
    return answer(`${step.label} ✓`);
  }

  if (kind === "s") {
    const step = SERVICE_NEXT[code];
    if (!step || actor.type !== "partner") return answer("Sizda bu amal uchun ruxsat yo'q.");
    const now = new Date().toISOString();
    const { data: upd } = await sb.from("erp_service_orders")
      .update({ order_status: step.to, updated_at: now, ...(step.to === "bajarildi" ? { completed_at: now } : {}) })
      .eq("id", id).eq("assigned_partner_id", actor.id).in("order_status", step.from).select("id, order_id");
    if (!upd?.length) {
      const card = await serviceCard(sb, id);
      if (card && card.partnerId === actor.id) await edit(card.text, card.buttons);
      return answer("Holat allaqachon o'zgargan.");
    }
    if (step.to === "bajarildi") {
      await sb.from("erp_service_partners").update({ is_available: true, status: "bosh" }).eq("id", actor.id);
    }
    await log(sb, chatId, actor, "service_status", { service_id: id, status: step.to });
    const card = await serviceCard(sb, id);
    if (card) await edit(card.text, card.buttons);
    await tellSeller(sb, upd[0].order_id, `${actor.name}: ${SERVICE_STATUS[step.to]}`);
    return answer(`${step.label} ✓`);
  }

  if (kind === "draft") {
    const { handleDraftCallback } = await import("./draft.ts");
    return handleDraftCallback(sb, cb, actor);
  }

  return answer("Noma'lum amal.");
}

async function tellSeller(sb: Sb, orderId: string | null, text: string) {
  if (!orderId) return;
  const { data: o } = await sb.from("erp_orders").select("order_number, created_by_user_id").eq("id", orderId).maybeSingle();
  if (!o?.created_by_user_id) return;
  const { data: st } = await sb.from("erp_staff").select("telegram_chat_id").eq("user_id", o.created_by_user_id)
    .eq("is_active", true).maybeSingle();
  if (st?.telegram_chat_id) await send(st.telegram_chat_id, `Buyurtma <b>${esc(o.order_number)}</b>\nHamkor ${esc(text)}`);
}
