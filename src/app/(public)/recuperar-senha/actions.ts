"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { z } from "zod";
import crypto from "crypto";

export async function requestPasswordReset(email: string): Promise<{ token?: string; error?: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, email: true }
    });

    if (!user) return { error: "Nenhuma conta encontrada com este email." };

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Remove tokens antigos para este email
    await prisma.verificationToken.deleteMany({ where: { identifier: user.email } });

    await prisma.verificationToken.create({
      data: { identifier: user.email, token, expires }
    });

    return { token };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao gerar token." };
  }
}

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres").max(72)
});

export async function resetPassword(raw: { token: string; password: string }): Promise<{ error?: string }> {
  try {
    const { token, password } = resetSchema.parse(raw);

    const record = await prisma.verificationToken.findUnique({ where: { token } });
    if (!record) return { error: "Token inválido ou já utilizado." };
    if (record.expires < new Date()) return { error: "Token expirado. Solicite um novo." };

    const user = await prisma.user.findUnique({ where: { email: record.identifier } });
    if (!user) return { error: "Usuário não encontrado." };

    const passwordHash = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.verificationToken.delete({ where: { token } })
    ]);

    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: err instanceof Error ? err.message : "Erro ao redefinir senha." };
  }
}
