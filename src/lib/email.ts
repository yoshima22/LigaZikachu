/**
 * Serviço de email da Liga Zikachu.
 * Usa Gmail via Nodemailer (sem domínio próprio necessário).
 *
 * Configurar no Vercel → Environment Variables:
 *   GMAIL_USER          = ligazikachu.noreply@gmail.com
 *   GMAIL_APP_PASSWORD  = xxxx xxxx xxxx xxxx  (Senha de App do Google)
 */

import * as nodemailer from "nodemailer";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://liga-zikachu.vercel.app";

function createTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass }
  });
}

// ── Reminder de envio de deck ─────────────────────────────────────────────────

interface DeckReminderParams {
  to: string;
  playerName: string;
  opponentName: string;
  matchDate: Date;
  tournamentName: string;
  weekLabel: string;
  deckLink: string;
}

export async function sendDeckReminderEmail(params: DeckReminderParams): Promise<{ error?: string }> {
  const transporter = createTransport();
  if (!transporter) return { error: "Email não configurado." };

  const { to, playerName, opponentName, matchDate, tournamentName, weekLabel, deckLink } = params;

  const fmt = (d: Date) => d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

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
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#FFCB05;">Liga Zikachu</h1>
      <p style="margin:4px 0 0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:2px;">Laboratório do Professor Enguiça</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:16px;color:#f8fafc;font-weight:600;">Olá, ${playerName}!</p>

      <p style="margin:0 0 16px;font-size:14px;color:#94a3b8;line-height:1.7;">
        O Professor Enguiça estava organizando os registros do campeonato e percebeu que sua lista ainda não apareceu por aqui.
      </p>

      <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.7;">
        Você possui uma partida agendada nas próximas 24 horas e ainda não enviou seu deck.
      </p>

      <!-- Match info card -->
      <div style="background:#0f172a;border:1px solid rgba(255,203,5,0.15);border-radius:12px;padding:20px;margin:0 0 24px;">
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:18px;">📅</span>
            <div>
              <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Data / Hora</p>
              <p style="margin:2px 0 0;font-size:14px;color:#f8fafc;font-weight:600;">${fmt(matchDate)}</p>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:18px;">⚔️</span>
            <div>
              <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Adversário</p>
              <p style="margin:2px 0 0;font-size:14px;color:#f8fafc;font-weight:600;">${opponentName}</p>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:18px;">🏆</span>
            <div>
              <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Campeonato / Semana</p>
              <p style="margin:2px 0 0;font-size:14px;color:#f8fafc;font-weight:600;">${tournamentName} — ${weekLabel}</p>
            </div>
          </div>
        </div>
      </div>

      <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.7;">
        Para evitar correria de última hora, envie sua lista assim que possível:
      </p>

      <div style="text-align:center;margin:28px 0;">
        <a href="${deckLink}"
          style="display:inline-block;background:#FFCB05;color:#1A1A2E;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">
          📋 Enviar meu deck agora
        </a>
      </div>

      <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;line-height:1.7;">
        O laboratório agradece sua colaboração — e seus adversários também.
      </p>

      <div style="border-top:1px solid rgba(255,203,5,0.1);margin:24px 0;"></div>

      <div style="background:#0f172a;border-left:3px solid #FFCB05;border-radius:0 8px 8px 0;padding:12px 16px;margin:0 0 24px;">
        <p style="margin:0 0 4px;font-size:11px;color:#FFCB05;font-weight:700;text-transform:uppercase;letter-spacing:1px;">💡 Dica do Professor</p>
        <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
          Deck enviado cedo significa menos problemas e mais tempo para se preocupar com o que realmente importa: a próxima batalha.
        </p>
      </div>

      <p style="margin:0 0 2px;font-size:14px;color:#FFCB05;font-weight:700;">Boa sorte, Treinador!</p>
      <p style="margin:0;font-size:13px;color:#64748b;">Professor Enguiça — Liga Zikachu</p>
    </div>

    <!-- Footer -->
    <div style="background:#0f0f1a;padding:20px 32px;border-top:1px solid rgba(255,203,5,0.08);text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;color:#475569;">Este lembrete foi enviado automaticamente pela Liga Zikachu.</p>
      <p style="margin:0 0 4px;font-size:11px;color:#475569;">Se já enviou seu deck, pode ignorar este e-mail.</p>
      <p style="margin:12px 0 0;font-size:11px;color:#FFCB05;font-weight:600;">Liga Zikachu — Live Championship</p>
    </div>
  </div>
</body>
</html>`;

  const text = `
Liga Zikachu — Lembrete de envio de deck

Olá, ${playerName}!

O Professor Enguiça estava organizando os registros do campeonato e percebeu que sua lista ainda não apareceu por aqui.

Você possui uma partida agendada nas próximas 24 horas e ainda não enviou seu deck.

📅 Data/Hora: ${fmt(matchDate)}
⚔️ Adversário: ${opponentName}
🏆 Campeonato: ${tournamentName} — ${weekLabel}

Para evitar correria de última hora, envie sua lista assim que possível:
${deckLink}

O laboratório agradece sua colaboração e seus adversários também.

Boa sorte, Treinador!
Professor Enguiça
Liga Zikachu

━━━━━━━━━━━━━━━━━━━━━━

Dica do Professor:
Deck enviado cedo significa menos problemas e mais tempo para se preocupar com o que realmente importa: a próxima batalha.
`.trim();

  try {
    await transporter.sendMail({
      from: `"Professor Enguiça · Liga Zikachu" <${process.env.GMAIL_USER}>`,
      to,
      subject: `⚠️ Deck não enviado — ${weekLabel} · ${tournamentName}`,
      text,
      html,
    });
    return {};
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Email:DeckReminder]", msg);
    return { error: msg };
  }
}

// ── Reset de senha ────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  to: string,
  token: string
): Promise<{ error?: string }> {
  const transporter = createTransport();

  if (!transporter) {
    console.error(
      "[Email] GMAIL_USER ou GMAIL_APP_PASSWORD não configurados. " +
      "Adicione em Vercel > Settings > Environment Variables."
    );
    return { error: "Serviço de e-mail não configurado. Entre em contato com o admin da Liga." };
  }

  const resetLink = `${APP_URL}/redefinir-senha?token=${token}`;
  const fromName = process.env.GMAIL_USER ?? "Liga Zikachu";

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:system-ui,sans-serif;color:#f8fafc;">
  <div style="max-width:520px;margin:40px auto;background:#1A1A2E;border-radius:16px;border:1px solid rgba(255,203,5,0.2);overflow:hidden;">
    <div style="background:linear-gradient(135deg,#1A1A2E,#2a1a3e);padding:32px 32px 24px;text-align:center;border-bottom:1px solid rgba(255,203,5,0.15);">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;background:linear-gradient(135deg,#FFCB05,#FFD700);border-radius:50%;margin-bottom:12px;">
        <span style="font-size:22px;">⚡</span>
      </div>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#FFCB05;">Liga Zikachu</h1>
      <p style="margin:4px 0 0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:2px;">Live Championship</p>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:16px;color:#f8fafc;font-weight:600;">Olá, Treinador!</p>
      <p style="margin:0 0 16px;font-size:14px;color:#94a3b8;line-height:1.6;">
        Recebemos uma solicitação para redefinir a senha da sua conta na Liga Zikachu.
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.6;">
        Para criar uma nova senha, clique no botão abaixo:
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetLink}"
          style="display:inline-block;background:#FFCB05;color:#1A1A2E;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">
          🔐 Redefinir minha senha
        </a>
      </div>
      <p style="margin:24px 0 8px;font-size:12px;color:#64748b;line-height:1.6;">
        Por motivos de segurança, este link possui validade de <strong style="color:#94a3b8;">1 hora</strong> e poderá ser utilizado apenas uma vez.
      </p>
      <p style="margin:0 0 24px;font-size:12px;color:#64748b;line-height:1.6;">
        Se você não solicitou esta alteração, pode ignorar este e-mail com segurança. Sua senha atual continuará funcionando normalmente.
      </p>
      <div style="border-top:1px solid rgba(255,203,5,0.1);margin:24px 0;"></div>
      <p style="margin:0;font-size:14px;color:#FFCB05;font-weight:600;">Nos vemos na próxima batalha!</p>
      <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Equipe Liga Zikachu</p>
    </div>
    <div style="background:#0f0f1a;padding:20px 32px;border-top:1px solid rgba(255,203,5,0.08);text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;color:#475569;">Este e-mail foi enviado automaticamente pela Liga Zikachu.</p>
      <p style="margin:0 0 4px;font-size:11px;color:#475569;">Caso tenha recebido esta mensagem por engano, nenhuma ação é necessária.</p>
      <p style="margin:12px 0 0;font-size:11px;color:#FFCB05;font-weight:600;">Liga Zikachu</p>
      <p style="margin:2px 0 0;font-size:10px;color:#334155;">Temporadas, batalhas, rankings e recompensas em um só lugar.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `
Liga Zikachu — Redefinição de senha

Olá, Treinador!

Recebemos uma solicitação para redefinir a senha da sua conta na Liga Zikachu.

Para criar uma nova senha, acesse o link abaixo:
${resetLink}

Por motivos de segurança, este link possui validade de 1 hora e poderá ser utilizado apenas uma vez.

Se você não solicitou esta alteração, ignore este e-mail. Sua senha atual continuará funcionando normalmente.

Nos vemos na próxima batalha!
Equipe Liga Zikachu

━━━━━━━━━━━━━━━━━━━━━━
Este e-mail foi enviado automaticamente pela Liga Zikachu.
Caso tenha recebido por engano, nenhuma ação é necessária.
`.trim();

  try {
    await transporter.sendMail({
      from: `"Liga Zikachu" <${fromName}>`,
      to,
      subject: "Redefinição de senha — Liga Zikachu",
      text,  // versão texto puro (reduz chance de spam)
      html,
    });
    return {};
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Email] Gmail send error:", msg);

    if (msg.includes("Invalid login") || msg.includes("Username and Password")) {
      return { error: "Credenciais de email inválidas. Verifique GMAIL_APP_PASSWORD no Vercel." };
    }
    if (msg.includes("Less secure")) {
      return { error: "Use uma Senha de App do Google (não a senha normal da conta Gmail)." };
    }
    return { error: "Não foi possível enviar o e-mail. Tente novamente em alguns minutos." };
  }
}
