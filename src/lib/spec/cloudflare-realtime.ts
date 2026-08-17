import type { SpecMediaProvider, PublishTracksInput, PullTracksInput } from "./provider";

// Implementação do provider usando a API do Cloudflare Realtime SFU.
// Base: https://rtc.live.cloudflare.com/v1 · Auth: Bearer <App Secret>.
// Server-only: as credenciais nunca vão ao browser.

const BASE_URL = process.env.CLOUDFLARE_REALTIME_BASE_URL ?? "https://rtc.live.cloudflare.com/v1";

type SessionDescription = { type: "offer" | "answer"; sdp: string };

function appPath(suffix: string) {
  const appId = process.env.CLOUDFLARE_REALTIME_APP_ID;
  return `${BASE_URL}/apps/${appId}/${suffix}`;
}

async function cf<T>(url: string, method: "POST" | "PUT", body?: unknown): Promise<T> {
  const token = process.env.CLOUDFLARE_REALTIME_APP_TOKEN;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Cloudflare Realtime ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export function createCloudflareRealtimeProvider(): SpecMediaProvider {
  return {
    name: "cloudflare-realtime",

    async createSession() {
      const data = await cf<{ sessionId: string }>(appPath("sessions/new"), "POST", {});
      return { sessionId: data.sessionId };
    },

    async publishTracks(input: PublishTracksInput) {
      const data = await cf<{ sessionDescription: SessionDescription }>(
        appPath(`sessions/${input.sessionId}/tracks/new`),
        "POST",
        {
          sessionDescription: { type: "offer", sdp: input.offerSdp },
          tracks: input.tracks.map((t) => ({ location: "local", mid: t.mid, trackName: t.trackName })),
        },
      );
      return { answerSdp: data.sessionDescription.sdp };
    },

    async pullTracks(input: PullTracksInput) {
      const data = await cf<{ sessionDescription: SessionDescription; requiresImmediateRenegotiation?: boolean }>(
        appPath(`sessions/${input.sessionId}/tracks/new`),
        "POST",
        {
          tracks: input.trackNames.map((trackName) => ({ location: "remote", sessionId: input.remoteSessionId, trackName })),
        },
      );
      return { offerSdp: data.sessionDescription.sdp, requiresImmediateRenegotiation: data.requiresImmediateRenegotiation !== false };
    },

    async renegotiate(input: { sessionId: string; answerSdp: string }) {
      await cf(appPath(`sessions/${input.sessionId}/renegotiate`), "PUT", {
        sessionDescription: { type: "answer", sdp: input.answerSdp },
      });
    },

    async closeSession() {
      // O SFU expira sessões ociosas sozinho. O encerramento efetivo acontece ao
      // fechar a PeerConnection no cliente e marcar a live como ENDED no banco.
    },
  };
}
