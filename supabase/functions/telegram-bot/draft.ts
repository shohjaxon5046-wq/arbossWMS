import {
  type Actor, type Sb, esc, send, tg, inline, type Callback, ORDER_STATUS
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
  else if (d.data.delivery_type === "pickup") lines.push("Olib ketish: ombordan");
  if (d.data.notes) lines.push(`Izoh: ${esc(String(d.data.notes))}`);
  return lines.join("\n");
}

const CANCEL = "Bekor qilish";

export async function startOrderDraft(sb: Sb, actor: Extract<Actor, { type: "staff" }>) {
  await clearDraft(sb, actor.chatId);
  await saveDraft(sb, actor.chatId, "category", { item_ids: [], item_labels: [] });
  await sendCategoryKeyboard(sb, actor.chatId);
  return send(actor.chatId, "Buyurtma jarayoni boshlandi. Bekor qilish uchun tugmani bosing.", {
    reply_markup: { keyboard: [[{ text: CANCEL }]], resize_keyboard: true }
  });
}

async function sendCategoryKeyboard(sb: Sb, chatId: string, editMsgId?: number) {
  const { data } = await sb.from("erp_categories").select("id, name").order("name");
  const buttons = (data || []).map(c => [{ text: c.name, callback_data: `draft:cat:${c.id}` }]);
  const text = "<b>1. Uskuna toifasini tanlang:</b>";
  if (editMsgId) {
    await tg("editMessageText", { chat_id: chatId, message_id: editMsgId, text, parse_mode: "HTML", ...inline(buttons) });
  } else {
    await send(chatId, text, inline(buttons));
  }
}

async function sendModelKeyboard(sb: Sb, chatId: string, catId: string, editMsgId: number) {
  const { data: models } = await sb.from("erp_product_models")
    .select("id, name")
    .eq("category_id", catId)
    .eq("is_active", true)
    .order("name");
    
  const { data: items } = await sb.from("erp_product_items")
    .select("model_id")
    .eq("status", "omborda_bosh");
    
  const availableIds = new Set((items || []).map(i => i.model_id));
  const availableModels = (models || []).filter(m => availableIds.has(m.id));

  const buttons = availableModels.map(m => [{ text: m.name, callback_data: `draft:mod:${m.id}` }]);
  buttons.push([{ text: "⬅️ Orqaga (Toifalar)", callback_data: "draft:back:cat" }]);
  await tg("editMessageText", { chat_id: chatId, message_id: editMsgId, text: "<b>2. Bo'sh uskunani tanlang:</b>", parse_mode: "HTML", ...inline(buttons) });
}

async function sendModelCard(sb: Sb, chatId: string, modelId: string, editMsgId: number) {
  const { data: m } = await sb.from("erp_product_models").select("*").eq("id", modelId).maybeSingle();
  if (!m) return;
  const text = `<b>${esc(m.name)}</b>\n\nNarx (kunlik): ${m.daily_price} so'm\nZalog: ${m.deposit_amount} so'm`;
  
  // Try to find available item
  const { data: items } = await sb.from("erp_product_items").select("id, serial_number").eq("model_id", modelId).eq("status", "omborda_bosh").limit(1);
  const available = items && items.length > 0;
  
  let buttons = [];
  if (available) {
    buttons.push([{ text: "✅ Savatga qo'shish", callback_data: `draft:add:${m.id}` }]);
  }
  buttons.push([{ text: "⬅️ Orqaga (Modellar)", callback_data: `draft:back:mod:${m.category_id}` }]);

  let pic = m.image_url;
  if (pic && !pic.startsWith("http")) pic = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/model-images/${pic}`;

  // Delete previous message and send photo
  await tg("deleteMessage", { chat_id: chatId, message_id: editMsgId });
  if (pic) {
    await tg("sendPhoto", { chat_id: chatId, photo: pic, caption: text + (available ? "" : "\n\n<i>Kechirasiz, omborda qolmagan</i>"), parse_mode: "HTML", ...inline(buttons) });
  } else {
    await send(chatId, text + (available ? "" : "\n\n<i>Kechirasiz, omborda qolmagan</i>"), inline(buttons));
  }
}

export async function handleDraftCallback(sb: Sb, cb: Callback, actor: Actor) {
  const answer = (text?: string) => tg("answerCallbackQuery", { callback_query_id: cb.id, text, show_alert: false });
  const draft = await loadDraft(sb, actor.chatId);
  if (!draft) return answer("Buyurtma topilmadi. Qaytadan boshlang.");
  
  const parts = cb.data?.split(":") ?? [];
  const action = parts[1];
  const id = parts[2];

  if (action === "cat") {
    await sendModelKeyboard(sb, actor.chatId, id, cb.message!.message_id);
    return answer();
  }
  if (action === "mod") {
    await sendModelCard(sb, actor.chatId, id, cb.message!.message_id);
    return answer();
  }
  if (action === "back") {
    if (id === "cat") {
      await sendCategoryKeyboard(sb, actor.chatId, cb.message!.message_id);
    } else if (id === "mod") {
      const catId = parts[3];
      // Since it might be a photo message, editMessageText fails if it's a photo.
      // So delete and send new.
      await tg("deleteMessage", { chat_id: actor.chatId, message_id: cb.message!.message_id });
      const { data: models } = await sb.from("erp_product_models")
        .select("id, name")
        .eq("category_id", catId)
        .eq("is_active", true)
        .order("name");
      const { data: items } = await sb.from("erp_product_items")
        .select("model_id")
        .eq("status", "omborda_bosh");
      const availableIds = new Set((items || []).map(i => i.model_id));
      const availableModels = (models || []).filter(m => availableIds.has(m.id));

      const buttons = availableModels.map(m => [{ text: m.name, callback_data: `draft:mod:${m.id}` }]);
      buttons.push([{ text: "⬅️ Orqaga (Toifalar)", callback_data: "draft:back:cat" }]);
      await send(actor.chatId, "<b>2. Bo'sh uskunani tanlang:</b>", inline(buttons));
    }
    return answer();
  }
  if (action === "add") {
    const { data: items } = await sb.from("erp_product_items").select("id, serial_number, erp_product_models(name)").eq("model_id", id).eq("status", "omborda_bosh").limit(1);
    if (!items || !items.length) return answer("Kechirasiz, omborda qolmagan.");
    const item = items[0];
    const m = item.erp_product_models as any;
    
    draft.data.item_ids = [...((draft.data.item_ids as string[]) || []), item.id];
    draft.data.item_labels = [...((draft.data.item_labels as string[]) || []), `${m.name} (${item.serial_number})`];
    
    // Move to next stage
    draft.stage = "customer";
    await saveDraft(sb, actor.chatId, draft.stage, draft.data);
    await tg("deleteMessage", { chat_id: actor.chatId, message_id: cb.message!.message_id });
    await send(actor.chatId, `${draftSummary(draft)}\n\nUskuna savatga qo'shildi!\n\n3. Mijozni toping: ismini yoki telefon raqamini yozing. (yoki <b>Bekor qilish</b>)`);
    return answer("Qo'shildi!");
  }
  
  return answer();
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

  // If they type text while in category picking, just ignore or ask to pick
  if (draft.stage === "category") {
    await send(actor.chatId, "Iltimos, yuqoridagi tugmalardan uskunani tanlang.", kb);
    return true;
  }

  if (draft.stage === "customer") {
    const customers = await findCustomers(sb, text);
    if (!customers.length) {
      await send(actor.chatId, "Mijoz topilmadi. Ism yoki telefon raqamini qayta yozing:", kb);
      return true;
    }
    if (customers.length === 1) {
      const c = customers[0];
      draft.data.customer_id = c.id;
      draft.data.customer_name = c.full_name;
      await saveDraft(sb, actor.chatId, "days", draft.data);
      await send(actor.chatId, `${draftSummary(draft)}\n\n4. Ijara muddati kunlarda (masalan: 3):`, kb);
      return true;
    }
    draft.data._matches = customers;
    await saveDraft(sb, actor.chatId, "customer_pick", draft.data);
    await send(actor.chatId, "Bir nechta mijoz topildi. To'liq ismini yozing:", kb);
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
    await send(actor.chatId, `${draftSummary(draft)}\n\n4. Ijara muddati kunlarda (masalan: 3):`, kb);
    return true;
  }

  if (draft.stage === "days") {
    const days = parseInt(text, 10);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      await send(actor.chatId, "Kunlar sonini 1 dan 365 gacha son bilan yozing:", kb);
      return true;
    }
    draft.data.rent_days = days;
    await saveDraft(sb, actor.chatId, "delivery", draft.data);
    await send(actor.chatId, `${draftSummary(draft)}\n\n5. Yetkazib berish kerakmi? <b>Ha</b> yoki <b>Yo'q</b>:`, kb);
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
      await send(actor.chatId, `${draftSummary(draft)}\n\n6. Izoh (yoki — bo'sh qoldirish uchun):`, kb);
      return true;
    }
    await send(actor.chatId, "<b>Ha</b> yoki <b>Yo'q</b> deb yozing:", kb);
    return true;
  }

  if (draft.stage === "delivery_address") {
    draft.data.delivery_address = text.trim().slice(0, 300);
    await saveDraft(sb, actor.chatId, "notes", draft.data);
    await send(actor.chatId, `${draftSummary(draft)}\n\n6. Izoh (yoki — bo'sh qoldirish uchun):`, kb);
    return true;
  }

  if (draft.stage === "notes") {
    draft.data.notes = text.trim() === "—" ? "" : text.trim().slice(0, 1000);
    await saveDraft(sb, actor.chatId, "confirm", draft.data);
    await send(
      actor.chatId,
      `${draftSummary(draft)}\n\nBarchasi to'g'rimi? Yaratish uchun <b>Tasdiqlash</b> tugmasini bosing.`,
      { reply_markup: { keyboard: [[{ text: "Tasdiqlash" }, { text: CANCEL }]], resize_keyboard: true } }
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
    
    // Use the RPC to create order
    const { data: created, error } = await sb.rpc("erp_bot_create_order", {
      p: payload,
      p_chat_id: actor.chatId,
    });
    
    if (error) {
      await send(actor.chatId, `Xatolik yuz berdi: ${error.message}\nQaytadan boshlang: /neworder`, { reply_markup: { remove_keyboard: true } });
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
      `✅ Buyurtma <b>${esc(number)}</b> yaratildi!\n\nOmbor xodimlariga xabar yuborildi. Buyurtmani dasturda ko'rishingiz mumkin.`,
      { reply_markup: { remove_keyboard: true } }
    );
    return true;
  }

  return false;
}

export function draftActive(d: Draft | null): boolean {
  return !!d && d.stage !== "confirm";
}
