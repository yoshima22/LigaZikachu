"use client";

type InteractionType = "PLAY" | "PET";
type OutboxEntry = { id: string; mascotId: string; type: InteractionType; createdAt: number; batchId?: string };
type OutboxWaiter = { resolve: () => void; reject: (error: Error) => void };

const STORAGE_KEY = "liga-mascot-interaction-outbox-v1";
const timers: Partial<Record<InteractionType, number>> = {};
const sending: Partial<Record<InteractionType, boolean>> = {};
const waiters = new Map<string, OutboxWaiter>();
const ENQUEUE_WINDOW_MS = 40;

function readOutbox(): OutboxEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    const oldestAllowed = Date.now() - 24 * 60 * 60_000;
    return parsed.filter((entry): entry is OutboxEntry => {
      if (!entry || typeof entry !== "object") return false;
      const row = entry as Partial<OutboxEntry>;
      return typeof row.id === "string"
        && typeof row.mascotId === "string"
        && (row.type === "PLAY" || row.type === "PET")
        && typeof row.createdAt === "number"
        && row.createdAt >= oldestAllowed;
    });
  } catch {
    return [];
  }
}

function writeOutbox(entries: OutboxEntry[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch { /* sem storage */ }
}

async function flush(type: InteractionType) {
  if (sending[type]) return;
  const currentTimer = timers[type];
  if (typeof currentTimer === "number") window.clearTimeout(currentTimer);
  delete timers[type];

  let outbox = readOutbox();
  const existingBatchId = outbox
    .filter(entry => entry.type === type && entry.batchId)
    .sort((a, b) => a.createdAt - b.createdAt)[0]?.batchId;
  const batchId = existingBatchId ?? crypto.randomUUID();
  if (!existingBatchId) {
    const selectedIds = new Set(outbox
      .filter(entry => entry.type === type && !entry.batchId)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 100)
      .map(entry => entry.id));
    outbox = outbox.map(entry => selectedIds.has(entry.id) ? { ...entry, batchId } : entry);
    writeOutbox(outbox);
  }
  const entries = outbox.filter(entry => entry.type === type && entry.batchId === batchId);
  if (entries.length === 0) return;
  sending[type] = true;

  try {
    const response = await fetch("/api/mascotes/interactions/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interactionType: type,
        scope: "SELECTION",
        mascotIds: Array.from(new Set(entries.map(entry => entry.mascotId))),
        idempotencyKey: `bank-${type.toLowerCase()}-${batchId}`,
      }),
      keepalive: true,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      const error = new Error(payload?.error || "Falha ao colocar a interacao na fila do servidor.");

      // Erros 4xx nao serao resolvidos por uma tentativa futura. Remove apenas
      // esse lote e devolve o erro ao botao; falhas transitorias continuam no
      // outbox para reenvio idempotente.
      if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
        const sentIds = new Set(entries.map(entry => entry.id));
        writeOutbox(readOutbox().filter(entry => !sentIds.has(entry.id)));
        for (const entry of entries) {
          waiters.get(entry.id)?.reject(error);
          waiters.delete(entry.id);
        }
        return;
      }
      throw error;
    }

    const sentIds = new Set(entries.map(entry => entry.id));
    writeOutbox(readOutbox().filter(entry => !sentIds.has(entry.id)));
    for (const entry of entries) {
      waiters.get(entry.id)?.resolve();
      waiters.delete(entry.id);
    }
  } catch {
    // O lote continua no dispositivo e sera reenviado nesta pagina, ao voltar
    // ao site ou pelo pagehide. Nada e descartado por falha de rede.
  } finally {
    sending[type] = false;
    if (readOutbox().some(entry => entry.type === type)) {
      timers[type] = window.setTimeout(() => void flush(type), 3_000);
    }
  }
}

/**
 * Primeiro grava o clique de forma sincrona no dispositivo e imediatamente
 * inicia o envio. A Promise so conclui depois do 202 do servidor: enquanto ela
 * estiver pendente, a UI mostra o spinner correto. A janela curta agrupa
 * cliques quase simultaneos sem atrasar perceptivelmente a confirmacao.
 */
export function queueMascotInteraction(mascotId: string, type: InteractionType) {
  const id = crypto.randomUUID();
  const entries = readOutbox();
  entries.push({ id, mascotId, type, createdAt: Date.now() });
  writeOutbox(entries);

  const currentTimer = timers[type];
  if (typeof currentTimer === "number") window.clearTimeout(currentTimer);
  timers[type] = window.setTimeout(() => void flush(type), ENQUEUE_WINDOW_MS);

  return new Promise<void>((resolve, reject) => {
    waiters.set(id, { resolve, reject });
  });
}

if (typeof window !== "undefined") {
  // Retoma automaticamente cliques preservados por um refresh/fechamento.
  if (readOutbox().some(entry => entry.type === "PLAY")) timers.PLAY = window.setTimeout(() => void flush("PLAY"), 50);
  if (readOutbox().some(entry => entry.type === "PET")) timers.PET = window.setTimeout(() => void flush("PET"), 50);

  window.addEventListener("online", () => {
    void flush("PLAY");
    void flush("PET");
  });
  window.addEventListener("pagehide", () => {
    void flush("PLAY");
    void flush("PET");
  });
}
