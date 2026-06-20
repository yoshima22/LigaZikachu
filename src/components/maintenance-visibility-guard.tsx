"use client";

import { useEffect } from "react";

const MIN_CHECK_INTERVAL_MS = 10_000;

export function MaintenanceVisibilityGuard() {
  useEffect(() => {
    let lastCheckAt = 0;
    let checking = false;

    const checkMaintenance = async () => {
      if (checking || document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastCheckAt < MIN_CHECK_INTERVAL_MS) return;
      lastCheckAt = now;
      checking = true;

      try {
        const response = await fetch("/api/maintenance-check", {
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Cache-Control": "no-cache" },
        });
        if (response.status === 503) {
          window.location.replace("/manutencao");
        }
      } catch {
        // Falha de rede nao deve expulsar o jogador; a proxima retomada tenta novamente.
      } finally {
        checking = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkMaintenance();
    };

    window.addEventListener("focus", checkMaintenance);
    window.addEventListener("online", checkMaintenance);
    document.addEventListener("visibilitychange", onVisibilityChange);
    void checkMaintenance();

    return () => {
      window.removeEventListener("focus", checkMaintenance);
      window.removeEventListener("online", checkMaintenance);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
