"use client";

import { useEffect } from "react";

// doc05: "FCM token — Upsert repetido" → salvar token/último envio localmente
// e reenviar só se mudou ou se passaram 24h, evitando upsert a cada navegação.
const LAST_TOKEN_KEY = "fcm_last_token";
const LAST_SENT_AT_KEY = "fcm_last_sent_at";
const RESEND_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function FcmTokenRegistrar() {
  useEffect(() => {
    const getBridge = () =>
      (window as unknown as { AndroidBridge?: { getFcmToken(): string } }).AndroidBridge;

    const register = async (token: string) => {
      try {
        const lastToken = localStorage.getItem(LAST_TOKEN_KEY);
        const lastSentAt = Number(localStorage.getItem(LAST_SENT_AT_KEY) ?? "0");
        const sameToken = lastToken === token;
        const recentlySent = Date.now() - lastSentAt < RESEND_INTERVAL_MS;
        if (sameToken && recentlySent) {
          return; // nada mudou — evita upsert desnecessário
        }

        const res = await fetch("/api/fcm-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });
        if (res.ok) {
          console.log("[FCM] Token registrado com sucesso");
          localStorage.setItem(LAST_TOKEN_KEY, token);
          localStorage.setItem(LAST_SENT_AT_KEY, String(Date.now()));
        }
      } catch (e) {
        console.warn("[FCM] Falha ao registrar token:", e);
      }
    };

    // Tenta até 6 vezes a cada 5 segundos (30s no total)
    // Isso resolve a corrida entre o Firebase retornar o token e a página carregar
    let attempts = 0;
    const MAX_ATTEMPTS = 6;

    const attempt = () => {
      attempts++;
      const bridge = getBridge();

      if (!bridge) {
        // Não está rodando no app Android — parar
        return;
      }

      const token = bridge.getFcmToken();
      if (token && token.length > 10) {
        register(token);
        return; // Sucesso — parar tentativas
      }

      if (attempts < MAX_ATTEMPTS) {
        console.log(`[FCM] Token não disponível ainda (tentativa ${attempts}/${MAX_ATTEMPTS}), aguardando...`);
        setTimeout(attempt, 5000);
      } else {
        console.warn("[FCM] Nenhum token FCM após 30s. Firebase pode não estar inicializado.");
      }
    };

    // Primeira tentativa imediata, depois a cada 5s
    attempt();
  }, []);

  return null;
}
