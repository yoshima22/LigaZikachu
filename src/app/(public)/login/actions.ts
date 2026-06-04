"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

type FormState = {
  error?: string;
};

export async function signInWithCredentials(
  _previousState: FormState | undefined,
  formData: FormData
): Promise<FormState | undefined> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
    const result = await signIn("credentials", {
      identifier,
      password,
      redirect: false
    });

    if (typeof result === "string") {
      const url = new URL(result, "https://liga-zikachu.vercel.app");
      const error = url.searchParams.get("error");
      if (error) {
        console.warn("[Login] NextAuth returned an error URL", { identifier, error });
        return { error: "Email ou senha invalidos. Verifique suas credenciais." };
      }
    }
  } catch (error) {
    if (error instanceof AuthError) {
      console.warn("[Login] AuthError", { identifier, type: error.type, cause: error.cause });
      if (error.type === "CredentialsSignin") {
        return { error: "Email ou senha invalidos. Verifique suas credenciais." };
      }
      if (error.type === "CallbackRouteError") {
        return { error: "Nao foi possivel concluir o login desta conta. Avise o admin para revisar o log do servidor." };
      }
      if (error.type === "AccessDenied") {
        return { error: "Acesso negado. Sua conta pode estar suspensa." };
      }
      return { error: "Nao foi possivel autenticar. Tente novamente." };
    }

    console.error("[Login] Erro inesperado:", error);
    return { error: "Erro interno. Tente novamente em alguns instantes." };
  }

  redirect("/dashboard");
}
