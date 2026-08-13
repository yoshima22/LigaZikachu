"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { ensureBeginnerOnboarding } from "@/lib/beginner-onboarding";
import { generateUniqueInviteCode } from "@/lib/invite-code";
import { parseBirthDateInput } from "@/lib/birthday";

type FormState = { error?: string };

const registerSchema = z.object({
  name:       z.string().trim().min(2).max(80),
  email:      z.string().trim().toLowerCase().email(),
  ptcglNick:  z.string().trim().min(2, "Nick do PTCG Live deve ter ao menos 2 caracteres.").max(60),
  password:   z.string().min(8).max(72),
  inviteCode: z.string().trim().regex(/^\d{6}$/, "O código de convite deve ter 6 dígitos."),
  birthDate:  z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe sua data de nascimento.")
});

export async function registerWithCredentials(
  _previousState: FormState | undefined,
  formData: FormData
): Promise<FormState | undefined> {
  const parsed = registerSchema.safeParse({
    name:       formData.get("name"),
    email:      formData.get("email"),
    ptcglNick:  formData.get("ptcglNick"),
    password:   formData.get("password"),
    inviteCode: formData.get("inviteCode"),
    birthDate:  formData.get("birthDate")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Preencha todos os campos corretamente." };
  }

  const { name, email, ptcglNick, password, inviteCode, birthDate } = parsed.data;
  const parsedBirthDate = parseBirthDateInput(birthDate);
  if (!parsedBirthDate) return { error: "Data de nascimento inválida." };

  // Código de convite é obrigatório e precisa pertencer a um jogador existente.
  const inviter = await prisma.player.findUnique({
    where: { inviteCode },
    select: { id: true }
  });
  if (!inviter) return { error: "Código de convite inválido. Peça o código de 6 dígitos de um jogador para criar sua conta." };

  // Verifica unicidade do email
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) return { error: "Já existe uma conta com esse email." };

  // Verifica unicidade do nick PTCG Live (case-insensitive)
  const existingNick = await prisma.player.findFirst({
    where: { ptcglNick: { equals: ptcglNick, mode: "insensitive" } }
  });
  if (existingNick) return { error: "Esse nick do PTCG Live já está em uso por outra conta." };

  const passwordHash = await hashPassword(password);

  // Código de convite único do novo jogador (ele também poderá convidar outros).
  const newInviteCode = await generateUniqueInviteCode(prisma);

  // Cria usuário + jogador + kit de boas-vindas em uma única transação.
  // Conta criada via código de convite válido já entra ATIVA (aprovada na hora).
  await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        status: "ACTIVE",
        player: {
          create: {
            displayName: name,
            ptcglNick,
            birthDate: parsedBirthDate,
            inviteCode: newInviteCode,
            invitedByPlayerId: inviter.id
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

    await ensureBeginnerOnboarding(playerId, tx);
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
