import "server-only";
import { after } from "next/server";

/**
 * Sinal "algo mudou, atualize" via Supabase Realtime Broadcast (REST).
 *
 * Substitui as escutas postgres_changes (a publicação supabase_realtime está
 * vazia, então elas nunca entregavam nada) e permite trocar polling de 1s por
 * atualização sob demanda. O payload é mínimo de propósito: os canais são
 * públicos (o login é NextAuth, não Supabase Auth), então o cliente sempre
 * busca os dados de verdade pelas actions autenticadas.
 *
 * Nunca lança erro e nunca atrasa a resposta: roda depois dela via after().
 */
export function signalRealtime(topics: string | string[], event: string, payload: Record<string, unknown> = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const list = (Array.isArray(topics) ? topics : [topics]).filter(Boolean);
  if (!url || !key || list.length === 0) return;
  const send = () =>
    fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: list.map((topic) => ({ topic, event, payload })) }),
      signal: AbortSignal.timeout(3_000),
    }).then(
      (res) => { if (!res.ok) console.warn("[realtime-signal] falhou", res.status, list, event); },
      (error) => console.warn("[realtime-signal] falhou", list, event, error),
    );
  try {
    after(send);
  } catch {
    // Fora do escopo de uma requisição (scripts): envia direto.
    void send();
  }
}
