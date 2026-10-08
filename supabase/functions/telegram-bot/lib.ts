import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

export type Sb = SupabaseClient;

export type Actor =
  | { type: "staff"; id: string; userId: string | null; name: string; role: string; phone: string | null; chatId: string }
  | { type: "partner"; id: string; name: string; category: string; chatId: string };

export type Button = { text: string; callback_data: string };

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export const serviceClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

export const botToken = () => Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";

export async function tg(method: string, payload: Record<string, unknown>) {
  const token = botToken();
  if (!token) return { ok: false, description: "TOKEN_MISSING" };
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
  if (!data.ok) console.error("telegram", method, data.description);
  return data as { ok: boolean; description?: string; result?: Record<string, unknown> };
}

export const send = (chatId: string, text: string, extra: Record<string, unknown> = {}) =>
  tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });

export const inline = (rows: Button[][]) => ({ reply_markup: { inline_keyboard: rows } });

export const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const money = (n: unknown) =>
  `${Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm`;

export const phoneKey = (p: unknown) => String(p ?? "").replace(/\D/g, "").slice(-9);

const TZ_MS = 5 * 3600 * 1000;

export function tashkentStart(kind: "day" | "month") {
  const local = new Date(Date.now() + TZ_MS);
  const d = kind === "day" ? local.getUTCDate() : 1;
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), d) - TZ_MS).toISOString();
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(new Date(iso).getTime() + TZ_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

export const ORDER_STATUS: Record<string, string> = {
  yangi: "Yangi",
  yigilmoqda: "Yig'ilmoqda",
  faol_ijarada: "Ijarada",
  kechikkan: "Kechikkan",
  yakunlandi: "Yakunlandi",
  bekor: "Bekor qilingan",
};

export const SERVICE_STATUS: Record<string, string> = {
  yangi: "Yangi",
  hamkor_qabul_qildi: "Qabul qilindi",
  hamkor_yolda: "Yo'lda",
  bajarilmoqda: "Bajarilmoqda",
  bajarildi: "Bajarildi",
  bekor: "Bekor qilingan",
};

export const SERVICE_CATEGORY: Record<string, string> = {
  avtokran: "Avtokran",
  musor: "Musor olib ketish",
  gruzchik: "Gruzchik",
};

export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export async function findActor(sb: Sb, chatId: string): Promise<Actor | null> {
  const { data: st } = await sb
    .from("erp_staff")
    .select("id, user_id, full_name, role, phone, is_active")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  if (st) {
    if (!st.is_active) return null;
    return { type: "staff", id: st.id, userId: st.user_id, name: st.full_name, role: st.role, phone: st.phone, chatId };
  }
  const { data: pt } = await sb
    .from("erp_service_partners")
    .select("id, company_name, service_category")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  if (pt) return { type: "partner", id: pt.id, name: pt.company_name, category: pt.service_category, chatId };
  return null;
}

export async function log(sb: Sb, chatId: string, actor: Actor | null, action: string, details: Record<string, unknown> = {}) {
  await sb.from("erp_bot_log").insert({
    chat_id: chatId,
    actor_type: actor?.type ?? "unknown",
    actor_id: actor?.id ?? null,
    actor_name: actor?.name ?? null,
    action,
    details,
  });
}
