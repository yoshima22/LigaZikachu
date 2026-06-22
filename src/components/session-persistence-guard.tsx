"use client";

import { useEffect } from "react";

const STORAGE_KEY = "lz_session_backup";
const COOKIE_NAME = "lz_session";
const CHECK_INTERVAL_MS = 8_000;

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
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
    const currentCookie = getCookie(COOKIE_NAME);
    if (currentCookie) {
      localStorage.setItem(STORAGE_KEY, currentCookie);
    }

    let restoring = false;

    const checkAndRestore = async () => {
      if (restoring) return;
      const cookie = getCookie(COOKIE_NAME);
      if (cookie) {
        localStorage.setItem(STORAGE_KEY, cookie);
        return;
      }

      const backup = localStorage.getItem(STORAGE_KEY);
      if (!backup) return;

      restoring = true;
      const ok = await restoreSession(backup);
      restoring = false;

      if (!ok) {
        localStorage.removeItem(STORAGE_KEY);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkAndRestore();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", () => void checkAndRestore());

    const interval = setInterval(checkAndRestore, CHECK_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  return null;
}
