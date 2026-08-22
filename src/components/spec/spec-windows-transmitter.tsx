"use client";

import { useEffect, useState, useTransition } from "react";
import { Download, MonitorUp, RefreshCw } from "lucide-react";
import { createWindowsTransmitterPairingAction, getWindowsTransmitterPairingStateAction } from "@/app/(app)/spec/windows-transmitter-actions";

const DOWNLOAD_URL = "https://github.com/yoshima22/LigaZikachu/releases/download/transmitter-latest/LigaZikachuTransmissor.exe";

export function SpecWindowsTransmitter({ streamId }: { streamId: string }) {
  const [pair, setPair] = useState<{ code: string; expiresAt: number } | null>(null);
  const [connected, setConnected] = useState<{ deviceName?: string; processName?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const generate = () => startTransition(async () => { const result = await createWindowsTransmitterPairingAction(streamId); if (result.code && result.expiresAt) { setPair({ code: result.code, expiresAt: result.expiresAt }); setConnected(null); } });

  useEffect(() => {
    if (!pair || connected) return;
    const timer = window.setInterval(() => { void getWindowsTransmitterPairingStateAction(streamId).then((state) => { if (state.connected) setConnected({ deviceName: state.deviceName, processName: state.processName }); }); }, 3000);
    return () => window.clearInterval(timer);
  }, [pair, connected, streamId]);

  return <section className="rounded-2xl border border-violet-400/25 bg-violet-950/10 p-4">
    <div className="flex items-start gap-3"><span className="rounded-xl bg-violet-400/10 p-2 text-violet-300"><MonitorUp size={22} /></span><div><p className="font-black text-white">Transmissor Windows · Beta fechado</p><p className="mt-1 text-xs leading-relaxed text-slate-400">Pareie o aplicativo da Liga e escolha o processo do jogo. Esta primeira etapa valida instalação, seleção e conexão segura antes de liberar a publicação nativa.</p></div></div>
    <div className="mt-4 flex flex-wrap gap-2"><a href={DOWNLOAD_URL} className="inline-flex items-center gap-2 rounded-xl border border-violet-400/40 px-4 py-2 text-xs font-bold text-violet-200 hover:bg-violet-500/10"><Download size={14} /> Baixar transmissor</a><button onClick={generate} disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-xs font-black text-white disabled:opacity-50"><RefreshCw size={14} className={pending ? "animate-spin" : ""} /> Gerar código</button></div>
    {pair && !connected && <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/70 p-4 text-center"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Código válido por 10 minutos</p><p className="mt-2 font-mono text-3xl font-black tracking-[0.2em] text-[#FFCB05]">{pair.code.slice(0, 5)}-{pair.code.slice(5)}</p></div>}
    {connected && <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 text-xs text-emerald-200"><strong>Transmissor conectado:</strong> {connected.deviceName ?? "Windows"}{connected.processName ? ` · ${connected.processName}` : ""}</div>}
  </section>;
}
