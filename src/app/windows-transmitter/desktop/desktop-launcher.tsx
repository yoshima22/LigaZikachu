"use client";

import { useEffect, useState } from "react";

export function DesktopLauncher({ name }: { name: string }) {
  const [message, setMessage] = useState("Criando sua transmissão…");

  useEffect(() => {
    const title = new URLSearchParams(window.location.search).get("title") || "Transmissão da Zika TV";
    void fetch("/api/spec/windows-transmitter/desktop-session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, deviceName: navigator.userAgent.slice(0, 80) }),
    }).then(async (response) => {
      const data = await response.json() as { streamId?: string; token?: string; error?: string };
      if (!response.ok || !data.streamId || !data.token) throw new Error(data.error || "Não foi possível criar a transmissão.");
      document.title = `ZIKA_LAUNCH:${btoa(JSON.stringify({ streamId: data.streamId, token: data.token }))}`;
      setMessage("Transmissão criada. Abrindo a central…");
    }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Não foi possível criar a transmissão."));
  }, []);

  return <main className="grid min-h-screen place-items-center bg-[#030718] p-6 text-center text-white"><section className="max-w-md rounded-2xl border border-violet-400/25 bg-[#0a1027] p-7"><p className="text-xs font-black uppercase tracking-[.2em] text-[#FFCB05]">Zika TV</p><h1 className="mt-2 text-2xl font-black">Olá, {name}</h1><p className="mt-4 text-sm leading-relaxed text-slate-300">{message}</p></section></main>;
}
