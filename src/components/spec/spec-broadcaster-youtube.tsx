"use client";

// Broadcaster do modo YouTube: o dono abre uma live NÃO LISTADA no YouTube
// (Studio "Transmitir agora" ou OBS) e cola a URL aqui. O app guarda o videoId e
// embute a live para a plateia — o fan-out fica por conta do CDN do YouTube.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { setSpecStreamYouTubeAction, endSpecStreamAction } from "@/app/(app)/spec/actions";
import { useSpecBroadcastLifecycle } from "./use-spec-broadcast-lifecycle";
import { SpecYoutubePlayer } from "./spec-youtube-player";

export function SpecBroadcasterYouTube({ streamId, matchLabel, live, currentVideoId }: { streamId: string; matchLabel: string; live: boolean; currentVideoId?: string | null }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pending, start] = useTransition();
  useSpecBroadcastLifecycle(streamId, live);

  const goLive = () => start(async () => {
    const res = await setSpecStreamYouTubeAction(streamId, url);
    if ("error" in res) { toast.error(res.error); return; }
    toast.success(live ? "Live do YouTube atualizada." : "Você está AO VIVO na Zika TV!");
    setUrl("");
    router.refresh();
  });

  const end = () => start(async () => {
    const res = await endSpecStreamAction(streamId);
    if ("error" in res) { toast.error(res.error); return; }
    toast.success("Transmissão encerrada.");
    router.push("/spec");
  });

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-slate-950/60 p-4">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-red-400">{live ? "🔴 Ao vivo (YouTube)" : "Modo YouTube"}</p>
        <h2 className="text-lg font-black text-white">{matchLabel}</h2>
      </div>

      <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-slate-300">
        <li>No YouTube, abra uma transmissão <strong>Não listada</strong> (YouTube Studio → <em>Criar → Transmitir ao vivo</em>, ou pelo OBS com sua chave de transmissão).</li>
        <li>Compartilhe sua tela do jogo por lá e deixe a live rodando.</li>
        <li>Copie o link da live (ex.: <code className="text-slate-400">youtube.com/watch?v=…</code> ou <code className="text-slate-400">youtu.be/…</code>) e cole abaixo.</li>
      </ol>

      <div className="space-y-2">
        <label className="text-[11px] font-bold text-slate-400">Link da live do YouTube</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
        />
        {currentVideoId && <p className="text-[10px] text-slate-500">Live atual embutida: <code className="text-slate-400">{currentVideoId}</code>. Cole um novo link para trocar.</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={goLive}
            disabled={pending || !url.trim()}
            className="rounded-xl bg-red-500 px-4 py-2 text-sm font-black text-white disabled:opacity-40"
          >
            {live ? "Atualizar live" : "Entrar AO VIVO"}
          </button>
          {live && (
            <button
              type="button"
              onClick={end}
              disabled={pending}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 disabled:opacity-40"
            >
              Encerrar transmissão
            </button>
          )}
        </div>
      </div>

      <p className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-2 text-[10px] leading-relaxed text-yellow-100">
        Use sempre o modo <strong>Não listado</strong> — a live não aparece na busca nem no seu canal, só dentro da Zika TV. O modo <strong>Privado</strong> do YouTube não pode ser embutido e não funciona aqui.
      </p>
      {live && currentVideoId && <div className="aspect-video overflow-hidden rounded-xl border border-border bg-black"><SpecYoutubePlayer streamId={streamId} videoId={currentVideoId} /></div>}
    </div>
  );
}
