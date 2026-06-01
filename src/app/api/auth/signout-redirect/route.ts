/**
 * GET /api/auth/signout-redirect
 * Faz signOut de forma confiável e redireciona para /login.
 * Usando rota dedicada para garantir que o cookie seja limpo corretamente.
 */
import { NextResponse } from "next/server";
import { signOut } from "@/auth";

export async function GET() {
  try {
    await signOut({ redirect: false });
  } catch {
    // ignora erros de signOut (pode lançar redirect internamente)
  }
  // Redireciona e instrui o browser a não cachear
  const res = NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL ?? "https://liga-zikachu.vercel.app"), {
    status: 302
  });
  // Limpa os cookies de sessão manualmente como garantia extra
  res.cookies.delete("next-auth.session-token");
  res.cookies.delete("__Secure-next-auth.session-token");
  res.cookies.delete("next-auth.csrf-token");
  res.cookies.delete("__Host-next-auth.csrf-token");
  return res;
}
