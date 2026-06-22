"use client";

import { useEffect } from "react";

const STORAGE_KEY = "lz_session_backup";

async function checkSession(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/session-check", {
      credentials: "same-origin",
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return true;
  }
}

async function restoreSession(token: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/restore-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      credentials: "same-origin",
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

export function SessionPersistenceGuard() {
  useEffect(() => {
    let busy = false;

    const onResume = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;

      try {
        const alive = await checkSession();
        if (alive) { busy = false; return; }

        const backup = localStorage.getItem(STORAGE_KEY);
        if (!backup) { busy = false; return; }

        const ok = await restoreSession(backup);
        if (ok) {
          window.location.reload();
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {}

      busy = false;
    };

    const onVis = () => { if (document.visibilityState === "visible") void onResume(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", () => void onResume());

    return () => {
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return null;
}
