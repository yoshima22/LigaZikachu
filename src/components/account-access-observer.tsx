"use client";

import { useEffect } from "react";

const DEVICE_KEY = "lz_device_id_v1";
const PING_INTERVAL_MS = 5 * 60_000;

function getDeviceId() {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID().replaceAll("-", "");
  localStorage.setItem(DEVICE_KEY, created);
  return created;
}

export function AccountAccessObserver({ userId }: { userId: string }) {
  useEffect(() => {
    const pingKey = `lz_access_ping_v1:${userId}`;
    const lastPing = Number(localStorage.getItem(pingKey) || 0);
    if (Date.now() - lastPing < PING_INTERVAL_MS) return;

    localStorage.setItem(pingKey, String(Date.now()));
    void fetch("/api/auth/access-observation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: getDeviceId() }),
      cache: "no-store",
      keepalive: true,
    }).then((response) => {
      if (!response.ok) localStorage.removeItem(pingKey);
    }).catch(() => localStorage.removeItem(pingKey));
  }, [userId]);

  return null;
}
