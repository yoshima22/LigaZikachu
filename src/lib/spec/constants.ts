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

/** Duração média estimada de cada sessão de espectador (min) — para estimar egress. */
export const SPEC_AVG_SESSION_MINUTES = Number(process.env.SPEC_AVG_SESSION_MINUTES ?? 30);

/** Teto mensal de egress (GB). Ao estimar acima disso, o SPEC se auto-desliga. */
export const SPEC_MONTHLY_GB_LIMIT = Number(process.env.SPEC_MONTHLY_GB_LIMIT ?? 950);

/** Bitrate total considerado no cálculo de egress (Mbps): vídeo + áudio. */
export const SPEC_TOTAL_MBPS = (SPEC_VIDEO_MAX_BITRATE + SPEC_AUDIO_TARGET_BITRATE) / 1_000_000;

/** Resolução da transmissão, definida pelo admin ao ativar o Modo SPEC. */
export type SpecResolution = "720" | "1080";

export const SPEC_DEFAULT_RESOLUTION: SpecResolution = "1080";

/** Frame rate alvo. TCG é quase estático: 12fps economiza muito sem perder leitura. */
export const SPEC_TARGET_FPS = Number(process.env.SPEC_TARGET_FPS ?? 12);

/**
 * Perfil de captura por resolução: dimensões-alvo + teto de bitrate de vídeo (bps).
 * Tetos enxutos porque conteúdo de tela (cartas/texto, pouco movimento) codifica
 * barato — e o bitrate multiplica pelo nº de espectadores no custo de egress.
 */
export const SPEC_RESOLUTION_PROFILES: Record<SpecResolution, { width: number; height: number; maxVideoBitrate: number; label: string }> = {
  "720":  { width: 1280, height: 720,  maxVideoBitrate: 900_000,   label: "720p" },
  "1080": { width: 1920, height: 1080, maxVideoBitrate: 1_500_000, label: "1080p" },
};

/** Política de quem pode abrir uma transmissão de uma partida. */
export type SpecBroadcasterPolicy =
  | "ANY_TOURNAMENT_PARTICIPANT"
  | "MATCH_PLAYERS_ONLY"
  | "ADMIN_ONLY";

export const SPEC_DEFAULT_BROADCASTER_POLICY: SpecBroadcasterPolicy = "ANY_TOURNAMENT_PARTICIPANT";
