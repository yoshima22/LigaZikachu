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

  // Cria usuário + jogador + kit de boas-vindas em uma única transação
  await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
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
      },
      include: { player: { select: { id: true } } }
    });

    const playerId = newUser.player?.id;
    if (!playerId) return;

    // ── Kit de boas-vindas ────────────────────────────────────────────────
    const INITIAL_ZC = 200;

    // Carteira com ZikaCoins iniciais
    const wallet = await tx.zikaCoinWallet.create({
      data: { playerId, balance: INITIAL_ZC, totalEarned: INITIAL_ZC }
    });
    await tx.zikaCoinTransaction.create({
      data: {
        walletId: wallet.id,
        type: "ADMIN_ADJUSTMENT",
        amount: INITIAL_ZC,
        balanceBefore: 0,
        balanceAfter: INITIAL_ZC,
        description: "Boas-vindas à Liga Zikachu! 🎉"
      }
    });

    // Ovos: 3 raros + 1 comum
    await tx.mascotEgg.createMany({
      data: [
        { playerId, type: "RARE",   origin: "Kit de boas-vindas" },
        { playerId, type: "RARE",   origin: "Kit de boas-vindas" },
        { playerId, type: "RARE",   origin: "Kit de boas-vindas" },
        { playerId, type: "COMMON", origin: "Kit de boas-vindas" },
      ]
    });

    // Comida e doces de mascote
    await tx.mascotFoodItem.createMany({
      data: [
        { playerId, type: "FOOD",  quantity: 5 },
        { playerId, type: "SWEET", quantity: 3 },
      ]
    });
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
