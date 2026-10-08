import {
  type Actor, type Sb, esc, ORDER_STATUS, send,
} from "./lib.ts";

type Draft = { chat_id: string; stage: string; data: Record<string, unknown> };

export async function loadDraft(sb: Sb, chatId: string): Promise<Draft | null> {
  const { data } = await sb.from("erp_bot_draft").select("stage, data").eq("chat_id", chatId).maybeSingle();
  if (!data) return null;
  return { chat_id: chatId, stage: data.stage, data: (data.data ?? {}) as Record<string, unknown> };
}

export async function saveDraft(sb: Sb, chatId: string, stage: string, data: Record<string, unknown>) {
  await sb.from("erp_bot_draft").upsert({ chat_id: chatId, stage, data, updated_at: new Date().toISOString() });
}

export async function clearDraft(sb: Sb, chatId: string) {
  await sb.from("erp_bot_draft").delete().eq("chat_id", chatId);
}

type Customer = { id: string; full_name: string; phone_primary: string };

async function findCustomers(sb: Sb, query: string): Promise<Customer[]> {
  const digits = query.replace(/\D/g, "");
  let req = sb.from("erp_customers").select("id, full_name, phone_primary").limit(6);
  if (digits.length >= 6) {
    req = req.ilike("phone_primary", `%${digits.slice(-7)}%`);
  } else {
    req = req.ilike("full_name", `%${query}%`);
  }
  const { data } = await req;
  return (data ?? []) as Customer[];
}

function draftSummary(d: Draft): string {
  const lines: string[] = ["<b>Yangi buyurtma</b>"];
  if (d.data.customer_name) lines.push(`Mijoz: ${esc(String(d.data.customer_name))}`);
  if (d.data.rent_days) lines.push(`Muddat: ${esc(String(d.data.rent_days))} kun`);
  if (Array.isArray(d.data.item_labels) && d.data.item_labels.length) {
    lines.push("Uskunalar:");
    for (const l of d.data.item_labels as string[]) lines.push(`  • ${esc(l)}`);
  }
  if (d.data.delivery_type === "delivery") lines.push(`Yetkazish: ${esc(String(d.data.delivery_address || "—"))}`);
  else lines.push("Olib ketish: ombordan");
  if (d.data.notes) lines.push(`Izoh: ${esc(String(d.data.notes))}`);
  return lines.join("\n");
}

const CANCEL = "Bekor qilish";
const DONE = "Tayyor";

export async function startOrderDraft(sb: Sb, actor: Extract<Actor, { type: "staff" }>) {
  await clearDraft(sb, actor.chatId);
  await saveDraft(sb, actor.chatId, "customer", {});
  return send(
    actor.chatId,
    "<b>Yangi buyurtma</b>\n\n1/5. Mijozni toping: ismini yoki telefon raqamini yozing.",
    { reply_markup: { keyboard: [[{ text: CANCEL }]], resize_keyboard: true, one_time_keyboard: true } },
  );
}

export async function handleDraftStep(sb: Sb, actor: Extract<Actor, { type: "staff" }>, text: string): Promise<boolean> {
  const draft = await loadDraft(sb, actor.chatId);
  if (!draft) return false;
  const kb = { reply_markup: { keyboard: [[{ text: CANCEL }]], resize_keyboard: true } };

  if (text === CANCEL) {
    await clearDraft(sb, actor.chatId);
    await send(actor.chatId, "Buyurtma bekor qilindi.", { reply_markup: { remove_keyboard: true } });
    return true;
  }

  if (draft.stage === "customer") {
    const customers = await findCustomers(sb, text);
    if (!customers.length) {
      await send(actor.chatId, "Mijoz topilmadi. Ism yoki telefon raqamini qayta yozing (yoki " + CANCEL + ").", kb);
      return true;
    }
    if (customers.length === 1) {
      const c = customers[0];
      draft.data.customer_id = c.id;
      draft.data.customer_name = c.full_name;
      await saveDraft(sb, actor.chatId, "days", draft.data);
      await send(actor.chatId, `${draftSummary(draft)}\n\n2/5. Ijara muddati kunlarda (masalan: 3):`, kb);
      return true;
    }
    draft.data._matches = customers;
    await saveDraft(sb, actor.chatId, "customer_pick", draft.data);
    await send(
      actor.chatId,
      "Bir nechta mijoz topildi. To'liq ismini yozing:",
      kb,
    );
    return true;
  }

  if (draft.stage === "customer_pick") {
    const matches = (draft.data._matches ?? []) as Customer[];
    const exact = matches.find(m => m.full_name.toLowerCase() === text.toLowerCase());
    if (!exact) {
      await send(actor.chatId, "Aniq ismni tanlang — ro'yxatdagi mijozning to'liq ismini yozing:", kb);
      return true;
    }
    draft.data.customer_id = exact.id;
    draft.data.customer_name = exact.full_name;
    delete draft.data._matches;
    await saveDraft(sb, actor.chatId, "days", draft.data);
    await send(actor.chatId, `${draftSummary(draft)}\n\n2/5. Ijara muddati kunlarda (masalan: 3):`, kb);
    return true;
  }

  if (draft.stage === "days") {
    const days = parseInt(text, 10);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      await send(actor.chatId, "Kunlar sonini 1 dan 365 gacha son bilan yozing:", kb);
      return true;
    }
    draft.data.rent_days = days;
    await saveDraft(sb, actor.chatId, "items", draft.data);
    await send(
      actor.chatId,
      `${draftSummary(draft)}\n\n3/5. Uskuna seriya raqamini yozing (birma-bir). Uskunalar tugadi bo'lsa — <b>${DONE}</b> deb yozing.`,
      kb,
    );
    return true;
  }

  if (draft.stage === "items") {
    if (text.toLowerCase() === DONE.toLowerCase()) {
      const labels = (draft.data.item_labels ?? []) as string[];
      const ids = (draft.data.item_ids ?? []) as string[];
      if (!ids.length) {
        await send(actor.chatId, "Kamida bitta uskuna kerak. Seriya raqamini yozing:", kb);
        return true;
      }
      await saveDraft(sb, actor.chatId, "delivery", draft.data);
      await send(
        actor.chatId,
        `${draftSummary(draft)}\n\n4/5. Yetkazib berish kerakmi? <b>Ha</b> yoki <b>Yo'q</b>:`,
        kb,
      );
      return true;
    }
    const { data: item } = await sb.from("erp_product_items")
      .select("id, serial_number, status, erp_product_models(name, is_active)")
      .eq("serial_number", text.trim())
      .maybeSingle();
    if (!item) {
      await send(actor.chatId, "Bunday seriya raqamli uskuna topilmadi. Qayta yozing:", kb);
      return true;
    }
    const model = item.erp_product_models as unknown as { name: string; is_active: boolean } | null;
    if (item.status !== "omborda_bosh" || !model?.is_active) {
      await send(actor.chatId, `Uskuna <b>${esc(model?.name ?? "")}</b> hozir bo'sh emas (holat: ${esc(item.status)}). Boshqa seriya raqami yozing:`, kb);
      return true;
    }
    const ids = ((draft.data.item_ids ?? []) as string[]).filter(x => x !== item.id);
    const labels = ((draft.data.item_labels ?? []) as string[]).filter(x => !x.includes(item.serial_number));
    ids.push(item.id);
    labels.push(`${model.name} (${item.serial_number})`);
    draft.data.item_ids = ids;
    draft.data.item_labels = labels;
    await saveDraft(sb, actor.chatId, "items", draft.data);
    await send(
      actor.chatId,
      `${draftSummary(draft)}\n\nYana uskuna qo'shsangiz seriya raqamini yozing, tugadi bo'lsa — <b>${DONE}</b>:`,
      kb,
    );
    return true;
  }

  if (draft.stage === "delivery") {
    const t = text.trim().toLowerCase();
    if (t === "ha") {
      draft.data.delivery_type = "delivery";
      await saveDraft(sb, actor.chatId, "delivery_address", draft.data);
      await send(actor.chatId, `${draftSummary(draft)}\n\nYetkazish manzilini yozing:`, kb);
      return true;
    }
    if (t === "yo'q" || t === "yoq" || t === "yo‘q" || t === "yoʻq") {
      draft.data.delivery_type = "pickup";
      await saveDraft(sb, actor.chatId, "notes", draft.data);
      await send(actor.chatId, `${draftSummary(draft)}\n\n5/5. Izoh (yoki — bo'sh qoldirish uchun):`, kb);
      return true;
    }
    await send(actor.chatId, "<b>Ha</b> yoki <b>Yo'q</b> deb yozing:", kb);
    return true;
  }

  if (draft.stage === "delivery_address") {
    draft.data.delivery_type = "delivery";
    draft.data.delivery_address = text.trim().slice(0, 300);
    await saveDraft(sb, actor.chatId, "notes", draft.data);
    await send(actor.chatId, `${draftSummary(draft)}\n\n5/5. Izoh (yoki — bo'sh qoldirish uchun):`, kb);
    return true;
  }

  if (draft.stage === "notes") {
    draft.data.notes = text.trim() === "—" ? "" : text.trim().slice(0, 1000);
    await saveDraft(sb, actor.chatId, "confirm", draft.data);
    await send(
      actor.chatId,
      `${draftSummary(draft)}\n\nBuyurtmani yaratish uchun <b>Tasdiqlash</b> tugmasini bosing.`,
      {
        reply_markup: {
          keyboard: [[{ text: "Tasdiqlash" }, { text: CANCEL }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      },
    );
    return true;
  }

  if (draft.stage === "confirm") {
    if (text.trim().toLowerCase() !== "tasdiqlash") {
      await send(actor.chatId, "Tasdiqlash uchun <b>Tasdiqlash</b> tugmasini bosing yoki " + CANCEL + ".", {
        reply_markup: { keyboard: [[{ text: "Tasdiqlash" }, { text: CANCEL }]], resize_keyboard: true },
      });
      return true;
    }
    const payload = {
      customer_id: draft.data.customer_id,
      rent_days: draft.data.rent_days,
      item_ids: draft.data.item_ids ?? [],
      delivery_type: draft.data.delivery_type ?? "pickup",
      delivery_address: draft.data.delivery_address ?? "",
      notes: draft.data.notes ?? "",
    };
    const { data: created, error } = await sb.rpc("erp_bot_create_order", {
      p: payload,
      p_chat_id: actor.chatId,
    });
    if (error) {
      const msg = String(error.message || "");
      if (msg.includes("ITEM_UNAVAILABLE")) {
        await send(actor.chatId, "Ba'zi uskunalar allaqachon band bo'lib qolgan. Buyurtma yaratilmadi — qaytadan boshlang: /neworder", { reply_markup: { remove_keyboard: true } });
      } else if (msg.includes("CUSTOMER_REQUIRED")) {
        await send(actor.chatId, "Mijoz topilmadi. Qaytadan boshlang: /neworder", { reply_markup: { remove_keyboard: true } });
      } else {
        await send(actor.chatId, "Xatolik yuz berdi. Qaytadan boshlang: /neworder", { reply_markup: { remove_keyboard: true } });
      }
      await clearDraft(sb, actor.chatId);
      return true;
    }
    const number = created?.order_number ?? "";
    await clearDraft(sb, actor.chatId);
    const { data: card } = await sb.from("erp_orders").select("id").eq("order_number", number).maybeSingle();
    if (card) {
      const { notifyOrder } = await import("./jobs.ts");
      await notifyOrder(sb, card.id, actor);
    }
    await send(
      actor.chatId,
      `✅ Buyurtma <b>${esc(number)}</b> yaratildi!\n\nOmbor xodimlariga xabar yuborildi. Buyurtma holatini "Mening buyurtmalarim" bo'limida kuzatib boring.`,
      { reply_markup: { remove_keyboard: true } },
    );
    return true;
  }

  return false;
}

export function draftActive(d: Draft | null): boolean {
  return !!d && d.stage !== "confirm";
}
