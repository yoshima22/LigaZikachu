"use client";

import { useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { useZikaTvVolume, ZikaTvVolumeControl } from "./use-zika-tv-volume";
import { reportSpecYoutubeEndedAction } from "@/app/(app)/spec/actions";

declare global {
  interface Window {
    YT?: { Player: new (elementId: string, options: Record<string, unknown>) => { destroy: () => void; setVolume: (volume: number) => void; mute: () => void; unMute: () => void } };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadYoutubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(); };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
  return apiPromise;
}

export function SpecYoutubePlayer({ streamId, videoId, interactive = true }: { streamId: string; videoId: string; interactive?: boolean }) {
  const router = useRouter();
  const { volume, setVolume } = useZikaTvVolume();
  const rawId = useId();
  const elementId = `spec-youtube-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const reportedRef = useRef(false);
  const playerRef = useRef<{ destroy: () => void; setVolume: (volume: number) => void; mute: () => void; unMute: () => void } | null>(null);
  const volumeRef = useRef(volume);

  useEffect(() => {
    volumeRef.current = volume;
    const player = playerRef.current;
    if (!player) return;
    player.setVolume(Math.round(volume * 100));
    if (volume === 0) player.mute(); else player.unMute();
  }, [volume]);

  useEffect(() => {
    let destroyed = false;
    let player: { destroy: () => void; setVolume: (volume: number) => void; mute: () => void; unMute: () => void } | null = null;
    void loadYoutubeApi().then(() => {
      if (destroyed || !window.YT?.Player) return;
      player = new window.YT.Player(elementId, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: (event: { target: { setVolume: (volume: number) => void; mute: () => void; unMute: () => void } }) => {
            playerRef.current = player;
            event.target.setVolume(Math.round(volumeRef.current * 100));
            if (volumeRef.current === 0) event.target.mute(); else event.target.unMute();
          },
          onStateChange: (event: { data: number }) => {
            // A API oficial usa 0 exclusivamente para vídeo/live encerrado.
            if (event.data === 0 && !reportedRef.current) {
              reportedRef.current = true;
              void reportSpecYoutubeEndedAction(streamId, videoId).then(() => {
                window.dispatchEvent(new CustomEvent("zika-tv-stream-ended", { detail: { streamId } }));
                router.refresh();
              });
            }
          },
        },
      });
    });
    return () => { destroyed = true; playerRef.current = null; player?.destroy(); };
  }, [elementId, streamId, videoId, router]);

  return <div className="relative h-full w-full"><div className={`${interactive ? "" : "pointer-events-none"} h-full w-full`}><div id={elementId} className="h-full w-full" /></div><div className="absolute bottom-2 right-2 z-10"><ZikaTvVolumeControl compact volume={volume} onChange={setVolume} /></div></div>;
}
