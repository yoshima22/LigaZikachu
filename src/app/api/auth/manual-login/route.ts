import { NextResponse } from "next/server";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!identifier || password.length < 8) {
      return NextResponse.json({ error: "Email ou senha invalidos.", code: "INVALID_INPUT" }, { status: 401 });
    }

    const result = await signIn("credentials", {
      identifier,
      password,
      redirect: false
    });

    if (typeof result === "string") {
      const url = new URL(result, "https://liga-zikachu.vercel.app");
      const error = url.searchParams.get("error");
      if (error) {
        console.warn("[ManualLogin] NextAuth returned error URL", { identifier, error });
        return NextResponse.json({ error: "Email ou senha invalidos.", code: error }, { status: 401 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      console.warn("[ManualLogin] AuthError", { type: error.type, cause: error.cause });
      const status = error.type === "CredentialsSignin" ? 401 : 500;
      return NextResponse.json({
        error: error.type === "CredentialsSignin"
          ? "Email ou senha invalidos."
          : "Nao foi possivel concluir o login.",
        code: error.type
      }, { status });
    }

    console.error("[ManualLogin] erro inesperado", error);
    return NextResponse.json({ error: "Erro interno no login manual.", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
