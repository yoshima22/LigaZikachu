"use server";

import { AuthError } from "next-auth";
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
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/dashboard"
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return {
          error: "Email ou senha inválidos."
        };
      }

      return {
        error: "Não foi possível autenticar agora."
      };
    }

    throw error;
  }
}
