"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

type FormState = { error?: string };

const registerSchema = z.object({
  name:      z.string().trim().min(2).max(80),
  email:     z.string().trim().toLowerCase().email(),
  ptcglNick: z.string().trim().min(2, "Nick do PTCG Live deve ter ao menos 2 caracteres.").max(60),
  password:  z.string().min(8).max(72)
});

export async function registerWithCredentials(
  _previousState: FormState | undefined,
  formData: FormData
): Promise<FormState | undefined> {
  const parsed = registerSchema.safeParse({
    name:      formData.get("name"),
    email:     formData.get("email"),
    ptcglNick: formData.get("ptcglNick"),
    password:  formData.get("password")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Preencha todos os campos corretamente." };
  }

  const { name, email, ptcglNick, password } = parsed.data;

  // Verifica unicidade do email
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) return { error: "Já existe uma conta com esse email." };

  // Verifica unicidade do nick PTCG Live (case-insensitive)
  const existingNick = await prisma.player.findFirst({
    where: { ptcglNick: { equals: ptcglNick, mode: "insensitive" } }
  });
  if (existingNick) return { error: "Esse nick do PTCG Live já está em uso por outra conta." };

  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      player: {
        create: {
          displayName: name,
          ptcglNick
        }
      }
    }
  });

  try {
    await signIn("credentials", {
      identifier: ptcglNick, // login automático pelo nick
      password,
      redirectTo: "/dashboard"
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Conta criada! Faça login com seu nick ou email." };
    }
    throw error;
  }
}
