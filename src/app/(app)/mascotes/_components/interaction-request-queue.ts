"use client";

type InteractionType = "PLAY" | "PET";
type Waiter = { resolve: () => void; reject: (error: Error) => void };
type PendingGroup = { mascotIds: Set<string>; waiters: Waiter[]; timer: number | null };

const groups: Record<InteractionType, PendingGroup> = {
  PLAY: { mascotIds: new Set(), waiters: [], timer: null },
  PET: { mascotIds: new Set(), waiters: [], timer: null },
};

async function flush(type: InteractionType) {
  const group = groups[type];
  if (group.timer !== null) window.clearTimeout(group.timer);
  group.timer = null;
  if (group.mascotIds.size === 0) return;

  const mascotIds = Array.from(group.mascotIds);
  const waiters = group.waiters.splice(0);
  group.mascotIds.clear();

  try {
    const response = await fetch("/api/mascotes/interactions/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interactionType: type,
        scope: "SELECTION",
        mascotIds,
        idempotencyKey: crypto.randomUUID(),
      }),
      keepalive: true,
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(payload.error || "Nao foi possivel registrar a interacao.");
    waiters.forEach(waiter => waiter.resolve());
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error("Falha ao registrar a interacao.");
    waiters.forEach(waiter => waiter.reject(normalized));
  }
}

/**
 * Agrupa cliques feitos quase simultaneamente em uma unica requisicao. Em uma
 * troca de rota o modulo continua vivo; ao fechar a aba, pagehide dispara o
 * envio keepalive do lote antes de o documento desaparecer.
 */
export function queueMascotInteraction(mascotId: string, type: InteractionType) {
  return new Promise<void>((resolve, reject) => {
    const group = groups[type];
    group.mascotIds.add(mascotId);
    group.waiters.push({ resolve, reject });
    if (group.timer !== null) window.clearTimeout(group.timer);
    group.timer = window.setTimeout(() => void flush(type), 80);
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    void flush("PLAY");
    void flush("PET");
  });
}
