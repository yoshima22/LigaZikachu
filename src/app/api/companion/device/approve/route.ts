import { getAppSession } from "@/lib/session";
import { pilotAllowed } from "@/lib/companion/pilot";
import { approveAuthorization } from "@/lib/companion/linking";
import { companionStore } from "@/lib/companion/store";
import { clientIp, rateLimit } from "@/lib/rate-limit";

async function allowedUser() {
  const session = await getAppSession().catch(() => null);
  const id = session?.user?.id;
  return id && pilotAllowed(id) && await companionStore.isEligible(id) ? id : null;
}
const headers = { "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", "X-Content-Type-Options": "nosniff" };
export async function GET() {
  if (!await allowedUser()) return new Response(null, { status: 404 });
  return new Response('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Vincular dispositivo</title><body><h1>Vincular ZikaCompanion</h1><form method="post"><label>Código do dispositivo <input name="userCode" required autocomplete="off"></label><button type="submit">Autorizar</button></form></body></html>', { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
}
export async function POST(request: Request) {
  const userId = await allowedUser();
  if (!userId) return new Response(null, { status: 404 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return new Response(null, { status: 403 });
  if (!rateLimit(`companion:approve:${clientIp(request.headers)}`, 20, 600_000)) return new Response(null, { status: 429 });
  const form = await request.formData().catch(() => null);
  const code = form?.get("userCode");
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(code)) return new Response("Código inválido", { status: 400, headers });
  const approved = await approveAuthorization(companionStore, code, userId);
  return new Response(approved ? "Dispositivo autorizado. Pode voltar ao aplicativo." : "Código inválido ou expirado.", { status: approved ? 200 : 400, headers });
}

