import { prisma } from "@/lib/prisma";
import {
  SPEC_SETTINGS_KEY,
  SPEC_AVG_SESSION_MINUTES,
  SPEC_MONTHLY_GB_LIMIT,
  SPEC_TOTAL_MBPS,
} from "./constants";
import { getSpecConfig } from "./config";

// Corte de segurança por estimativa de egress. Como não recebemos os GB exatos
// da Cloudflare em tempo real (e a spec pede não fazer heartbeat de espectador),
// contamos cada entrada de espectador no mês e estimamos o consumo:
//   GB ≈ joins × minutos_médios × Mbps_total × 60 / 8 / 1000
// Ao ultrapassar o teto, o Modo SPEC se auto-desliga (kill-switch), evitando
// custo além do free tier. É uma estimativa conservadora, não um valor exato.

function usageKey(date = new Date()) {
  const ym = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(date);
  return `spec_usage_${ym}`;
}

function estimateGb(joins: number) {
  return (joins * SPEC_AVG_SESSION_MINUTES * SPEC_TOTAL_MBPS * 60) / 8 / 1000;
}

export async function getSpecMonthlyUsage(): Promise<{ joins: number; estimatedGb: number; overLimit: boolean }> {
  const row = await prisma.appSetting.findUnique({ where: { key: usageKey() }, select: { value: true } }).catch(() => null);
  const joins = Number((row?.value as { joins?: number } | undefined)?.joins ?? 0);
  const estimatedGb = estimateGb(joins);
  return { joins, estimatedGb, overLimit: estimatedGb >= SPEC_MONTHLY_GB_LIMIT };
}

/**
 * Registra a entrada de um espectador e, se a estimativa passar do teto, desliga
 * o Modo SPEC. Retorna se está acima do limite (para recusar a conexão).
 */
export async function recordSpectatorJoinAndCheck(): Promise<{ overLimit: boolean }> {
  const key = usageKey();
  const row = await prisma.appSetting.findUnique({ where: { key }, select: { value: true } }).catch(() => null);
  const joins = Number((row?.value as { joins?: number } | undefined)?.joins ?? 0) + 1;
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: { joins } },
    update: { value: { joins } },
  }).catch(() => null);

  if (estimateGb(joins) >= SPEC_MONTHLY_GB_LIMIT) {
    // Auto-desliga o feature flag para não gerar custo além do free tier.
    const config = await getSpecConfig();
    await prisma.appSetting.upsert({
      where: { key: SPEC_SETTINGS_KEY },
      create: { key: SPEC_SETTINGS_KEY, value: { enabled: false, broadcasterPolicy: config.broadcasterPolicy } },
      update: { value: { enabled: false, broadcasterPolicy: config.broadcasterPolicy } },
    }).catch(() => null);
    return { overLimit: true };
  }
  return { overLimit: false };
}
