import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "Liga Zikachu <noreply@liga-zikachu.app>";
const APP_URL = process.env.NEXTAUTH_URL ?? "https://liga-zikachu.vercel.app";

export async function sendPasswordResetEmail(to: string, token: string): Promise<{ error?: string }> {
  const resetLink = `${APP_URL}/redefinir-senha?token=${token}`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:system-ui,sans-serif;color:#f8fafc;">
  <div style="max-width:520px;margin:40px auto;background:#1A1A2E;border-radius:16px;border:1px solid rgba(255,203,5,0.2);overflow:hidden;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1A1A2E,#2a1a3e);padding:32px 32px 24px;text-align:center;border-bottom:1px solid rgba(255,203,5,0.15);">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;background:linear-gradient(135deg,#FFCB05,#FFD700);border-radius:50%;margin-bottom:12px;">
        <span style="font-size:22px;">⚡</span>
      </div>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#FFCB05;letter-spacing:-0.5px;">Liga Zikachu</h1>
      <p style="margin:4px 0 0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:2px;">Live Championship</p>
    </div>
    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:16px;color:#f8fafc;font-weight:600;">Olá, Treinador!</p>
      <p style="margin:0 0 16px;font-size:14px;color:#94a3b8;line-height:1.6;">
        Recebemos uma solicitação para redefinir a senha da sua conta na Liga Zikachu.
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.6;">
        Para criar uma nova senha, clique no botão abaixo:
      </p>
      <!-- CTA Button -->
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetLink}" style="display:inline-block;background:#FFCB05;color:#1A1A2E;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.2px;">
          🔐 Redefinir minha senha
        </a>
      </div>
      <p style="margin:24px 0 8px;font-size:12px;color:#64748b;line-height:1.6;">
        Por motivos de segurança, este link possui validade de <strong style="color:#94a3b8;">1 hora</strong> e poderá ser utilizado apenas uma vez.
      </p>
      <p style="margin:0 0 24px;font-size:12px;color:#64748b;line-height:1.6;">
        Se você não solicitou esta alteração, pode ignorar este e-mail com segurança. Sua senha atual continuará funcionando normalmente.
      </p>
      <!-- Divider -->
      <div style="border-top:1px solid rgba(255,203,5,0.1);margin:24px 0;"></div>
      <p style="margin:0;font-size:14px;color:#FFCB05;font-weight:600;">Nos vemos na próxima batalha!</p>
      <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Equipe Liga Zikachu</p>
    </div>
    <!-- Footer -->
    <div style="background:#0f0f1a;padding:20px 32px;border-top:1px solid rgba(255,203,5,0.08);text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;color:#475569;">Este e-mail foi enviado automaticamente pela Liga Zikachu.</p>
      <p style="margin:0 0 4px;font-size:11px;color:#475569;">Caso tenha recebido esta mensagem por engano, nenhuma ação é necessária.</p>
      <p style="margin:12px 0 0;font-size:11px;color:#FFCB05;font-weight:600;">Liga Zikachu</p>
      <p style="margin:2px 0 0;font-size:10px;color:#334155;">Temporadas, batalhas, rankings e recompensas em um só lugar.</p>
    </div>
  </div>
</body>
</html>
`;

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: "Redefinição de senha — Liga Zikachu",
      html,
    });

    if (error) {
      console.error("[Email] Resend error:", error);
      return { error: "Não foi possível enviar o e-mail. Tente novamente." };
    }

    return {};
  } catch (err) {
    console.error("[Email] Exception:", err);
    return { error: "Erro ao enviar e-mail. Tente novamente." };
  }
}
