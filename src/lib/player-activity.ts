import type { Prisma } from "@prisma/client";

type ActivityDb = Pick<Prisma.TransactionClient, "playerActivityLog">;

export type PlayerActivityInput = {
  playerId?: string | null;
  actorUserId?: string | null;
  category: string;
  action: string;
  summary: string;
  source?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  amount?: number | null;
  unit?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
};

/** Registra uma operacao auditavel usando a mesma transacao do efeito real. */
export async function recordPlayerActivity(db: ActivityDb, input: PlayerActivityInput) {
  return db.playerActivityLog.create({
    data: {
      playerId: input.playerId ?? null,
      actorUserId: input.actorUserId ?? null,
      category: input.category.trim().toUpperCase(),
      action: input.action.trim().toUpperCase(),
      summary: input.summary.trim().slice(0, 500),
      source: input.source?.trim().slice(0, 120) || null,
      entityType: input.entityType?.trim().slice(0, 80) || null,
      entityId: input.entityId?.trim().slice(0, 160) || null,
      amount: Number.isFinite(input.amount) ? Math.trunc(input.amount!) : null,
      unit: input.unit?.trim().slice(0, 40) || null,
      beforeJson: input.before,
      afterJson: input.after,
      metadata: input.metadata,
    },
  });
}
