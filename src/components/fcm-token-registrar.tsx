"use client";

import { useEffect } from "react";

export function FcmTokenRegistrar() {
  useEffect(() => {
    const getBridge = () =>
      (window as unknown as { AndroidBridge?: { getFcmToken(): string } }).AndroidBridge;

    const register = async (token: string) => {
      try {
        const res = await fetch("/api/fcm-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });
        if (res.ok) console.log("[FCM] Token registrado com sucesso");
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
