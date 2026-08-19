// Configuração do Modo SPEC (transmissão de partidas). Valores server-side.
// Secrets da Cloudflare são lidos apenas no servidor (nunca NEXT_PUBLIC_*).

/** Chave da linha de configuração em AppSetting (feature flag + política). */
export const SPEC_SETTINGS_KEY = "spec_streaming";

/** Provider de mídia ativo. "stub" enquanto a Cloudflare não estiver configurada. */
export const SPEC_PROVIDER = process.env.SPEC_PROVIDER ?? "stub";

/** Alvo/limite de bitrate de vídeo (bps). */
export const SPEC_VIDEO_MAX_BITRATE = Number(process.env.SPEC_VIDEO_MAX_BITRATE ?? 2_500_000);

/** Alvo de bitrate de áudio (bps). */
export const SPEC_AUDIO_TARGET_BITRATE = Number(process.env.SPEC_AUDIO_TARGET_BITRATE ?? 96_000);

/** Duração máxima defensiva de uma live (minutos) — evita live fantasma. */
export const SPEC_MAX_STREAM_MINUTES = Number(process.env.SPEC_MAX_STREAM_MINUTES ?? 300);

/** Alerta interno de espectadores simultâneos (apenas referência de custo). */
export const SPEC_SOFT_MAX_CONCURRENT_VIEWERS = Number(process.env.SPEC_SOFT_MAX_CONCURRENT_VIEWERS ?? 20);

/** Máximo de transmissões AO VIVO simultâneas (limita fan-out total). */
export const SPEC_MAX_CONCURRENT_STREAMS = Number(process.env.SPEC_MAX_CONCURRENT_STREAMS ?? 3);

/** Duração média estimada de cada sessão de espectador (min) — legado. */
export const SPEC_AVG_SESSION_MINUTES = Number(process.env.SPEC_AVG_SESSION_MINUTES ?? 30);

/** Intervalo do heartbeat de presença do espectador (s). Espelha o cliente. */
export const SPEC_PRESENCE_HEARTBEAT_SECONDS = Number(process.env.SPEC_PRESENCE_HEARTBEAT_SECONDS ?? 15);

/**
 * Fator de utilização do bitrate no cálculo de egress. Conteúdo de tela (cartas,
 * pouco movimento) codifica bem abaixo do teto, então o consumo real fica em
 * torno de metade do teto configurado. Ajustável por env.
 */
export const SPEC_BITRATE_UTILIZATION = Number(process.env.SPEC_BITRATE_UTILIZATION ?? 0.5);

/** Teto mensal de egress (GB). Ao estimar acima disso, o SPEC se auto-desliga. */
export const SPEC_MONTHLY_GB_LIMIT = Number(process.env.SPEC_MONTHLY_GB_LIMIT ?? 950);

/** Bitrate total considerado no cálculo de egress (Mbps): vídeo + áudio. */
export const SPEC_TOTAL_MBPS = (SPEC_VIDEO_MAX_BITRATE + SPEC_AUDIO_TARGET_BITRATE) / 1_000_000;

/** Modo de transmissão ativo (selecionável pelo admin). */
export type SpecMode = "cloudflare-realtime" | "p2p-mesh" | "youtube";
export const SPEC_DEFAULT_MODE: SpecMode = SPEC_PROVIDER === "cloudflare-realtime" ? "cloudflare-realtime" : "cloudflare-realtime";

/**
 * Extrai o id de vídeo do YouTube a partir de uma URL (watch, youtu.be, live,
 * embed) ou de um id cru de 11 caracteres. Retorna null se não reconhecer.
 */
export function parseYouTubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const v = url.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      // formatos /live/<id>, /embed/<id>, /shorts/<id>
      const m = url.pathname.match(/\/(?:live|embed|shorts)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch { /* não é URL — cai fora */ }
  return null;
}

/** URL de embed sem cookies para o iframe do espectador. */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
}

/** Resolução da transmissão, definida pelo admin ao ativar o Modo SPEC. */
export type SpecResolution = "720" | "1080";

export const SPEC_DEFAULT_RESOLUTION: SpecResolution = "1080";

/** Frame rate alvo padrão (fallback quando não há escolha do admin). */
export const SPEC_TARGET_FPS = Number(process.env.SPEC_TARGET_FPS ?? 24);

/** Frame rate selecionável pelo admin. 24fps é o novo padrão (fluido sem exagero). */
export type SpecFps = 12 | 24 | 30;
export const SPEC_FPS_OPTIONS: SpecFps[] = [12, 24, 30];
export const SPEC_DEFAULT_FPS: SpecFps = 24;

/**
 * Prioridade de qualidade quando a banda/CPU aperta:
 * - "sharpness": mantém resolução (texto nítido) e derruba frames no movimento.
 * - "fluidity": mantém frame rate (movimento fluido) e derruba resolução no pico.
 */
export type SpecQualityPriority = "sharpness" | "fluidity";
export const SPEC_DEFAULT_QUALITY_PRIORITY: SpecQualityPriority = "sharpness";

/** Traduz a prioridade para as dicas do encoder WebRTC. */
export function specEncodeHints(priority: SpecQualityPriority): {
  contentHint: "detail" | "motion";
  degradationPreference: "maintain-resolution" | "maintain-framerate";
} {
  return priority === "fluidity"
    ? { contentHint: "motion", degradationPreference: "maintain-framerate" }
    : { contentHint: "detail", degradationPreference: "maintain-resolution" };
}

/** Escala o teto de bitrate conforme o FPS (mais frames precisam de mais bits). */
export function specScaledBitrate(base: number, fps: SpecFps): number {
  const factor = fps >= 30 ? 1.3 : fps >= 24 ? 1.0 : 0.7;
  return Math.round(base * factor);
}

/**
 * Perfil de captura por resolução: dimensões-alvo + teto de bitrate de vídeo (bps).
 * Tetos enxutos porque conteúdo de tela (cartas/texto, pouco movimento) codifica
 * barato — e o bitrate multiplica pelo nº de espectadores no custo de egress.
 */
export const SPEC_RESOLUTION_PROFILES: Record<SpecResolution, { width: number; height: number; maxVideoBitrate: number; label: string }> = {
  "720":  { width: 1280, height: 720,  maxVideoBitrate: 1_500_000, label: "720p" },
  "1080": { width: 1920, height: 1080, maxVideoBitrate: 3_000_000, label: "1080p" },
};

/**
 * Perfil do modo P2P mesh: mais enxuto que a Cloudflare porque o broadcaster
 * codifica UM stream por espectador (CPU cresce com a audiência). 540p/10fps com
 * bitrate baixo mantém a leitura das cartas e reduz muito o custo de encode.
 */
export const SPEC_P2P_PROFILE = {
  width: Number(process.env.SPEC_P2P_WIDTH ?? 960),
  height: Number(process.env.SPEC_P2P_HEIGHT ?? 540),
  fps: Number(process.env.SPEC_P2P_FPS ?? 10),
  maxVideoBitrate: Number(process.env.SPEC_P2P_BITRATE ?? 1_200_000),
  label: "540p",
};

/** Política de quem pode abrir uma transmissão de uma partida. */
export type SpecBroadcasterPolicy =
  | "ANY_TOURNAMENT_PARTICIPANT"
  | "MATCH_PLAYERS_ONLY"
  | "ADMIN_ONLY";

export const SPEC_DEFAULT_BROADCASTER_POLICY: SpecBroadcasterPolicy = "ANY_TOURNAMENT_PARTICIPANT";
