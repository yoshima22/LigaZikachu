import { SPEC_PROVIDER } from "./constants";
import { isSpecProviderConfigured } from "./config";

// Abstração do plano de mídia (WebRTC/SFU). Toda conversa com a Cloudflare fica
// atrás desta interface (server-only). O fluxo segue a API do Realtime SFU:
// cria-se uma Session (uma PeerConnection), publicam-se tracks locais (offer do
// cliente -> answer do SFU) e puxam-se tracks remotas (o SFU devolve uma offer
// que o espectador responde via renegotiate). O vídeo flui direto browser<->CF.

export type PublishTracksInput = {
  sessionId: string;
  offerSdp: string;
  tracks: Array<{ mid: string; trackName: string }>;
};

export type PullTracksInput = {
  sessionId: string;
  remoteSessionId: string;
  trackNames: string[];
};

export interface SpecMediaProvider {
  readonly name: string;
  /** Cria uma nova sessão (PeerConnection) no SFU. */
  createSession(): Promise<{ sessionId: string }>;
  /** Publica as tracks locais do broadcaster. Retorna a resposta SDP. */
  publishTracks(input: PublishTracksInput): Promise<{ answerSdp: string }>;
  /** Puxa tracks remotas (espectador). Retorna a oferta SDP do SFU. */
  pullTracks(input: PullTracksInput): Promise<{ offerSdp: string; requiresImmediateRenegotiation: boolean }>;
  /** Renegocia: o espectador envia a resposta SDP para as tracks puxadas. */
  renegotiate(input: { sessionId: string; answerSdp: string }): Promise<void>;
  /** Encerra uma sessão (best-effort). */
  closeSession(sessionId: string): Promise<void>;
}

export class SpecProviderNotConfiguredError extends Error {
  constructor() {
    super("O provedor de transmissão (Cloudflare Realtime) ainda não está configurado.");
    this.name = "SpecProviderNotConfiguredError";
  }
}

// Stub usado enquanto não há credenciais da Cloudflare.
const stubProvider: SpecMediaProvider = {
  name: "stub",
  async createSession() { throw new SpecProviderNotConfiguredError(); },
  async publishTracks() { throw new SpecProviderNotConfiguredError(); },
  async pullTracks() { throw new SpecProviderNotConfiguredError(); },
  async renegotiate() { throw new SpecProviderNotConfiguredError(); },
  async closeSession() { /* nada a fazer no stub */ },
};

let cloudflareProvider: SpecMediaProvider | null = null;

/** Retorna o provider ativo. Cai no stub quando não configurado. */
export function getSpecProvider(): SpecMediaProvider {
  if (SPEC_PROVIDER === "cloudflare-realtime" && isSpecProviderConfigured()) {
    if (!cloudflareProvider) {
      // Carregamento tardio para não importar a implementação quando não usada.
      const { createCloudflareRealtimeProvider } = require("./cloudflare-realtime") as typeof import("./cloudflare-realtime");
      cloudflareProvider = createCloudflareRealtimeProvider();
    }
    return cloudflareProvider;
  }
  return stubProvider;
}
