import { supabase } from '@/lib/supabase';

export async function callTelegramBot<T = Record<string, unknown>>(action: string, body: Record<string, unknown> = {}) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-bot`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
      Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...body }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) throw new Error(json?.error || `Request failed (${res.status})`);
  return json as T;
}
