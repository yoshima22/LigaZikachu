-- Varredura de expedições a finalizar (push-automation) filtra status + finishAt e lia ~17 mil linhas por chamada.
CREATE INDEX IF NOT EXISTS "mascot_expeditions_status_finishAt_idx" ON "mascot_expeditions" ("status", "finishAt");
