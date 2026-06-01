"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { sendPasswordResetEmail } from "@/lib/email";
import { z } from "zod";
import crypto from "crypto";

// ── Solicitar recuperação de senha ────────────────────────────────────────────

export async function requestPasswordReset(
  _prev: { error?: string; success?: boolean } | undefined,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();

  if (!email.includes("@")) {
    return { error: "Informe um e-mail válido." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true }
  });

  // Resposta genérica — não revela se email existe na base
  if (!user) {
    console.log(`[PasswordReset] Email "${email}" não encontrado na base.`);
    return { success: true };
  }

  // Invalida tokens anteriores do mesmo usuário
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  // Token seguro (64 bytes hex = 128 chars)
  const token = crypto.randomBytes(64).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await prisma.passwordResetToken.create({
    data: { token, userId: user.id, expiresAt }
  });

  console.log(`[PasswordReset] Tentando enviar email para: ${user.email}`);
  const { error } = await sendPasswordResetEmail(user.email, token);
  if (error) {
    console.error(`[PasswordReset] Falha ao enviar: ${error}`);
    return { error };
  }
  console.log(`[PasswordReset] Email enviado com sucesso para: ${user.email}`);

  return { success: true };
}

// ── Redefinir senha com token ─────────────────────────────────────────────────

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres.").max(72)
});

export async function resetPassword(
  raw: { token: string; password: string }
): Promise<{ error?: string }> {
  try {
    const { token, password } = resetSchema.parse(raw);

    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: { select: { id: true } } }
    });

    if (!record) return { error: "Link inválido ou já utilizado." };
    if (record.usedAt) return { error: "Este link já foi usado. Solicite um novo." };
    if (record.expiresAt < new Date()) return { error: "Link expirado (1 hora). Solicite um novo." };

    const passwordHash = await hashPassword(password);

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { token }, data: { usedAt: new Date() } })
    ]);

    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: err instanceof Error ? err.message : "Erro ao redefinir senha." };
  }
}
