import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { disconnectSeedPrisma, main as runSeed } from "../../../../../prisma/seed";

export const dynamic = "force-dynamic";

export async function POST() {
  const seedSecret = process.env.SEED_SECRET;

  if (!seedSecret) {
    return NextResponse.json({ error: "SEED_SECRET não configurado." }, { status: 500 });
  }

  const requestHeaders = await headers();
  const providedSecret = requestHeaders.get("x-seed-secret");

  if (providedSecret !== seedSecret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    await runSeed();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido ao rodar seed.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await disconnectSeedPrisma();
  }
}