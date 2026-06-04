"use server";

import { AuthError } from "next-auth";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { signIn } from "@/auth";

type FormState = {
  error?: string;
};

export async function signInWithCredentials(
  _previousState: FormState | undefined,
  formData: FormData
): Promise<FormState | undefined> {
  try {
    await signIn("credentials", {
      identifier: String(formData.get("identifier") ?? ""),
      password:   String(formData.get("password") ?? ""),
      redirectTo: "/dashboard"
    });
  } catch (error) {
    // Erros de redirect são esperados após login bem-sucedido — deixa propagar
    if (isRedirectError(error)) throw error;

    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { error: "Email ou senha inválidos. Verifique suas credenciais." };
      }
      if (error.type === "AccessDenied") {
        return { error: "Acesso negado. Sua conta pode estar suspensa." };
      }
      return { error: "Não foi possível autenticar. Tente novamente." };
    }

    // Qualquer outro erro — loga mas NÃO retorna 500 ao cliente
    console.error("[Login] Erro inesperado:", error);
    return { error: "Erro interno. Tente novamente em alguns instantes." };
  }
}
