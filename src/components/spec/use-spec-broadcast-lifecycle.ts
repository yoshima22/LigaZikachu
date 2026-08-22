"use client";

import { useEffect } from "react";

export function useSpecBroadcastLifecycle(streamId: string, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const url = `/api/spec/streams/${streamId}/lifecycle`;
    const heartbeat = () => { void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "heartbeat" }), keepalive: true }); };
    const finish = () => {
      const payload = new Blob([JSON.stringify({ event: "end" })], { type: "application/json" });
      if (!navigator.sendBeacon(url, payload)) void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "end" }), keepalive: true });
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 15_000);
    window.addEventListener("pagehide", finish);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", finish);
      // Uma navegação interna do Next desmonta a página sem fechar a aba. Não
      // encerramos no cleanup: o botão explícito/track ended encerra a live e
      // pagehide continua cobrindo fechamento ou recarga real da aba.
    };
  }, [streamId, active]);
}
