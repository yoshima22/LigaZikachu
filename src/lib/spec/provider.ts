import { SPEC_PROVIDER } from "./constants";
import { isSpecProviderConfigured } from "./config";

// Abstração do plano de mídia (WebRTC/SFU). Toda conversa com a Cloudflare fica
// atrás desta interface, para que componentes/rotas não dependam do provedor e
// seja possível trocar por outro SFU no futuro sem reescrever regras de torneio.
//
// O signaling é baseado em SDP: o browser gera a oferta, o backend negocia com o
// SFU usando credenciais server-only e devolve a resposta. O vídeo/áudio flui
// direto browser <-> Cloudflare (nunca pela Vercel/Supabase).

export type PublishResult = {
  sessionId: string;
  answerSdp: string;
  videoTrackId: string;
  audioTrackId: string | null;
};

export type SubscribeResult = {
  sessionId: string;
  answerSdp: string;
};

export interface SpecMediaProvider {
  readonly name: string;
  /** Cria a publicação do broadcaster a partir da oferta SDP do browser. */
  publish(input: { streamId: string; offerSdp: string }): Promise<PublishResult>;
  /** Cria a assinatura (pull) de um espectador para as tracks de uma live. */
  subscribe(input: {
    streamId: string;
    offerSdp: string;
    broadcastSessionId: string;
    videoTrackId: string;
    audioTrackId: string | null;
  }): Promise<SubscribeResult>;
  /** Encerra uma sessão no provedor (best-effort). */
  closeSession(sessionId: string): Promise<void>;
}

export class SpecProviderNotConfiguredError extends Error {
  constructor() {
    super("O provedor de transmissão (Cloudflare Realtime) ainda não está configurado.");
    this.name = "SpecProviderNotConfiguredError";
  }
}

// Stub usado enquanto não há credenciais da Cloudflare: permite construir e
// navegar todo o control plane, mas recusa qualquer operação de mídia com uma
// mensagem clara (em vez de falhar silenciosamente).
const stubProvider: SpecMediaProvider = {
  name: "stub",
  async publish() { throw new SpecProviderNotConfiguredError(); },
  async subscribe() { throw new SpecProviderNotConfiguredError(); },
  async closeSession() { /* nada a fazer no stub */ },
};

let cloudflareProvider: SpecMediaProvider | null = null;

/** Retorna o provider ativo. Cai no stub quando não configurado. */
export function getSpecProvider(): SpecMediaProvider {
  if (SPEC_PROVIDER === "cloudflare-realtime" && isSpecProviderConfigured()) {
    // A implementação Cloudflare entra aqui na Fase de mídia (quando houver
    // App ID + API token). Enquanto não existir, seguimos com o stub.
    return cloudflareProvider ?? stubProvider;
  }
  return stubProvider;
}

/** Injeta a implementação real (chamado pela camada Cloudflare quando pronta). */
export function registerCloudflareSpecProvider(provider: SpecMediaProvider) {
  cloudflareProvider = provider;
}
