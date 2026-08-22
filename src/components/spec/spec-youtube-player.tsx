"use client";

import { useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { reportSpecYoutubeEndedAction } from "@/app/(app)/spec/actions";

declare global {
  interface Window {
    YT?: { Player: new (elementId: string, options: Record<string, unknown>) => { destroy: () => void } };
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
  const rawId = useId();
  const elementId = `spec-youtube-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const reportedRef = useRef(false);

  useEffect(() => {
    let destroyed = false;
    let player: { destroy: () => void } | null = null;
    void loadYoutubeApi().then(() => {
      if (destroyed || !window.YT?.Player) return;
      player = new window.YT.Player(elementId, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
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
    return () => { destroyed = true; player?.destroy(); };
  }, [elementId, streamId, videoId, router]);

  return <div className={`${interactive ? "" : "pointer-events-none"} h-full w-full`}><div id={elementId} className="h-full w-full" /></div>;
}
