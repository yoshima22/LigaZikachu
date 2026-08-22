"use client";

import { useState } from "react";
import { SpecBroadcaster } from "./spec-broadcaster";
import { SpecBroadcasterP2P } from "./spec-broadcaster-p2p";
import { SpecBroadcasterYouTube } from "./spec-broadcaster-youtube";
import { SpecWindowsTransmitter } from "./spec-windows-transmitter";
import type { SpecFps, SpecQualityPriority } from "@/lib/spec/constants";

type Method = "p2p-mesh" | "youtube" | "cloudflare-realtime" | "windows-native";

export function SpecBroadcastMethodChooser(props: {
  streamId: string; matchLabel: string; status: string; provider: string;
  currentVideoId?: string | null; cloudflareEnabled: boolean;
  windowsTransmitterBeta?: boolean;
  windowsTransmitterConnected?: boolean;
  defaultFps: SpecFps; defaultQuality: SpecQualityPriority;
}) {
  const [started, setStarted] = useState(props.status === "LIVE");
  const locked = props.status === "LIVE" || started;
  const initial: Method = locked && props.windowsTransmitterConnected ? "windows-native" : locked && (props.provider === "youtube" || props.provider === "cloudflare-realtime" || props.provider === "p2p-mesh") ? props.provider : "p2p-mesh";
  const [method, setMethod] = useState<Method>(initial);
  const [resolution, setResolution] = useState<"540" | "720" | "1080">("720");
  const [fps, setFps] = useState<SpecFps>(props.defaultFps);
  const [quality, setQuality] = useState<SpecQualityPriority>(props.defaultQuality);

  const dimensions = resolution === "1080" ? [1920, 1080, 2_500_000] : resolution === "720" ? [1280, 720, 1_600_000] : [960, 540, 1_000_000];

  return <div className="space-y-4">
    {!locked && <section className="rounded-2xl border border-cyan-500/25 bg-cyan-950/10 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">Como você quer transmitir?</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MethodButton active={method === "p2p-mesh"} onClick={() => setMethod("p2p-mesh")} title="P2P direto" detail="Sempre disponível · sem egress de vídeo" />
        <MethodButton active={method === "youtube"} onClick={() => setMethod("youtube")} title="Link do YouTube" detail="Live não listada ou pública" />
        {props.cloudflareEnabled && <MethodButton active={method === "cloudflare-realtime"} onClick={() => setMethod("cloudflare-realtime")} title="Cloudflare" detail="Liberado pelo administrador" />}
        {props.windowsTransmitterBeta && <MethodButton active={method === "windows-native"} onClick={() => setMethod("windows-native")} title="Programa Windows" detail="Live independente do navegador" />}
      </div>
      {!props.cloudflareEnabled && <p className="mt-2 text-[10px] text-slate-500">Cloudflare está fechado. Um administrador precisa habilitá-lo manualmente.</p>}
    </section>}

    {method === "p2p-mesh" && <>
      {!locked && <section className="rounded-2xl border border-emerald-500/20 bg-slate-950/60 p-4">
        <p className="text-xs font-black text-emerald-300">Configuração P2P</p>
        <div className="mt-3 space-y-3 text-xs">
          <Choice label="Resolução" values={["540", "720", "1080"]} value={resolution} setValue={(v) => setResolution(v as typeof resolution)} suffix="p" />
          <Choice label="Quadros por segundo" values={["12", "24", "30"]} value={String(fps)} setValue={(v) => setFps(Number(v) as SpecFps)} suffix=" fps" />
          <div><span className="mr-2 font-bold text-slate-300">Prioridade:</span>{([['sharpness','Nitidez'],['fluidity','Fluidez']] as const).map(([v,l]) => <button key={v} onClick={() => setQuality(v)} className={`mr-2 rounded-lg border px-3 py-1.5 font-bold ${quality === v ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200' : 'border-border text-slate-400'}`}>{l}</button>)}</div>
        </div>
      </section>}
      <SpecBroadcasterP2P streamId={props.streamId} matchLabel={props.matchLabel} width={dimensions[0]} height={dimensions[1]} maxVideoBitrate={dimensions[2]} fps={fps} qualityPriority={quality} resolutionLabel={`${resolution}p · `} onLive={() => setStarted(true)} />
    </>}
    {method === "youtube" && <SpecBroadcasterYouTube streamId={props.streamId} matchLabel={props.matchLabel} live={locked} currentVideoId={props.currentVideoId} />}
    {method === "cloudflare-realtime" && props.cloudflareEnabled && <SpecBroadcaster streamId={props.streamId} matchLabel={props.matchLabel} width={1920} height={1080} maxVideoBitrate={3_000_000} fps={fps} qualityPriority={quality} resolutionLabel="1080p · " onLive={() => setStarted(true)} />}
    {method === "windows-native" && props.windowsTransmitterBeta && <SpecWindowsTransmitter streamId={props.streamId} />}
  </div>;
}

function MethodButton({ active, onClick, title, detail }: { active: boolean; onClick: () => void; title: string; detail: string }) {
  return <button onClick={onClick} className={`rounded-xl border p-3 text-left ${active ? "border-[#FFCB05] bg-[#FFCB05]/10" : "border-border bg-slate-950/50 hover:border-slate-600"}`}><strong className={active ? "text-[#FFCB05]" : "text-white"}>{title}</strong><span className="mt-1 block text-[10px] text-slate-400">{detail}</span></button>;
}

function Choice({ label, values, value, setValue, suffix }: { label: string; values: string[]; value: string; setValue: (v: string) => void; suffix: string }) {
  return <div><span className="mr-2 font-bold text-slate-300">{label}:</span>{values.map((v) => <button key={v} onClick={() => setValue(v)} className={`mr-2 rounded-lg border px-3 py-1.5 font-bold ${value === v ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200' : 'border-border text-slate-400'}`}>{v}{suffix}</button>)}</div>;
}
