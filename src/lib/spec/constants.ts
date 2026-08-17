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

/** Política de quem pode abrir uma transmissão de uma partida. */
export type SpecBroadcasterPolicy =
  | "ANY_TOURNAMENT_PARTICIPANT"
  | "MATCH_PLAYERS_ONLY"
  | "ADMIN_ONLY";

export const SPEC_DEFAULT_BROADCASTER_POLICY: SpecBroadcasterPolicy = "ANY_TOURNAMENT_PARTICIPANT";
