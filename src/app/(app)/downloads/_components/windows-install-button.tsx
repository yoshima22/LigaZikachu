"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, MonitorDown } from "lucide-react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function WindowsInstallButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setShowInstructions(false);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) {
      setShowInstructions(true);
      return;
    }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setPromptEvent(null);
  }

  if (installed) {
    return (
      <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-3.5 text-sm font-black uppercase tracking-wide text-cyan-100">
        <CheckCircle2 size={20} /> Aplicativo instalado
      </div>
    );
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={install}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-cyan-300 to-blue-600 px-5 py-3.5 text-sm font-black uppercase tracking-wide text-slate-950 shadow-[0_10px_30px_rgba(14,165,233,0.25)] transition hover:-translate-y-0.5 hover:brightness-110"
      >
        <MonitorDown size={21} /> Instalar no Windows
      </button>

      {showInstructions && (
        <div className="mt-3 rounded-xl border border-cyan-300/20 bg-slate-950/60 p-3 text-left text-xs leading-relaxed text-slate-300">
          <p className="font-bold text-cyan-200">Instalação pelo navegador</p>
          <p className="mt-1">
            No Chrome ou Edge, abra o menu do navegador e escolha <strong>Instalar Liga Zikachu</strong> ou <strong>Aplicativos → Instalar este site como aplicativo</strong>.
          </p>
        </div>
      )}
    </div>
  );
}
