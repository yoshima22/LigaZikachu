"use client";

import { useEffect } from "react";

export function FcmTokenRegistrar() {
  useEffect(() => {
    // Tenta pegar o token do bridge Android (injetado pelo app nativo)
    const tryRegister = async () => {
      try {
        const bridge = (window as unknown as { AndroidBridge?: { getFcmToken(): string } }).AndroidBridge;
        if (!bridge) return; // não está rodando no app Android

        const token = bridge.getFcmToken();
        if (!token) return;

        await fetch("/api/fcm-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });
      } catch {
        // silencioso — não quebra a UI
      }
    };

    // Registrar imediatamente e depois de 3s (FCM pode demorar para retornar o token)
    tryRegister();
    const timer = setTimeout(tryRegister, 3000);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
