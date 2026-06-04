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
    await signIn("credentials", {
      identifier,
      password,
      redirect: false
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { error: "Email ou senha invalidos. Verifique suas credenciais." };
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
