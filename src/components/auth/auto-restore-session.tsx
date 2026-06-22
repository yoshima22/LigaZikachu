"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "lz_session_backup";

export function AutoRestoreSession() {
  const [status, setStatus] = useState<"checking" | "restoring" | "done">("checking");

  useEffect(() => {
    const attempt = async () => {
      const backup = localStorage.getItem(STORAGE_KEY);
      if (!backup) { setStatus("done"); return; }

      setStatus("restoring");
      try {
        const res = await fetch("/api/auth/restore-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: backup }),
          credentials: "same-origin",
        });
        const data = await res.json();
        if (data.ok) {
          window.location.replace("/dashboard");
          return;
        }
      } catch {}

      localStorage.removeItem(STORAGE_KEY);
      setStatus("done");
    };

    attempt();
  }, []);

  if (status === "checking" || status === "restoring") {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#FFCB05] border-t-transparent" />
        <p className="text-xs text-slate-400">
          {status === "checking" ? "Verificando sessão..." : "Restaurando sessão..."}
        </p>
      </div>
    );
  }

  return null;
}
