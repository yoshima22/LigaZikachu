ALTER TABLE "mascots"
ADD COLUMN "primordialBoundPlayerId" TEXT;

-- Recupera o vínculo do uso primordial já registrado. O evento é criado na
-- mesma transação do reset e identifica o mascote sem inferir apenas pela
-- origem LAB, que também pode vir de ovos normais de laboratório.
UPDATE "mascots" AS mascot
SET
  "primordialBoundPlayerId" = mascot."playerId",
  "operationsLocked" = TRUE
FROM "players" AS player
WHERE player."id" = mascot."playerId"
  AND player."adminLabFeatherUsedAt" IS NOT NULL
  AND mascot."id" = (
    SELECT event."mascotId"
    FROM "mascot_events" AS event
    INNER JOIN "mascots" AS candidate ON candidate."id" = event."mascotId"
    WHERE candidate."playerId" = player."id"
      AND event."description" ILIKE '%Pena Arco-%'
      AND event."createdAt" BETWEEN player."adminLabFeatherUsedAt" - INTERVAL '5 minutes'
                                AND player."adminLabFeatherUsedAt" + INTERVAL '10 minutes'
    ORDER BY ABS(EXTRACT(EPOCH FROM (event."createdAt" - player."adminLabFeatherUsedAt"))) ASC
    LIMIT 1
  );

-- Defesa final no banco: nenhuma rota presente ou futura pode transferir um
-- mascote primordial para uma conta diferente da que utilizou a pena.
ALTER TABLE "mascots"
ADD CONSTRAINT "mascots_primordial_owner_check"
CHECK (
  "primordialBoundPlayerId" IS NULL
  OR "playerId" = "primordialBoundPlayerId"
);

CREATE INDEX "mascots_primordialBoundPlayerId_idx"
ON "mascots"("primordialBoundPlayerId");
