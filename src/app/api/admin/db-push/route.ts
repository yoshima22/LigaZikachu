import { NextResponse } from "next/server";
import { execSync } from "child_process";

/**
 * POST /api/admin/db-push
 * Aplica prisma db push no banco (schema sem perda de dados).
 * Protegido por x-seed-secret. Use apenas em staging/produção
 * quando o schema mudar e não for possível rodar localmente.
 *
 * Uso:
 *   curl -X POST https://<url>/api/admin/db-push \
 *     -H "x-seed-secret: zikachu-seed-2026-trocar-depois"
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-seed-secret");
  if (!secret || secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const output = execSync("npx prisma db push --accept-data-loss --skip-generate", {
      encoding: "utf-8",
      timeout: 60_000,
      env: { ...process.env }
    });

    return NextResponse.json({
      ok: true,
      output: output.trim().split("\n").slice(-10) // últimas 10 linhas
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message.substring(0, 500) }, { status: 500 });
  }
}
