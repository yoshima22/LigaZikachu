import { after, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { processMascotInteractionJob } from "@/lib/mascot-interaction-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RequestBody = {
  interactionType?: unknown;
  scope?: unknown;
  idempotencyKey?: unknown;
  mascotIds?: unknown;
};

export async function POST(request: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const body = await request.json().catch(() => null) as RequestBody | null;
  if (!body || (body.interactionType !== "PLAY" && body.interactionType !== "PET" && body.interactionType !== "FEED_FOOD" && body.interactionType !== "FEED_SWEET")) {
    return NextResponse.json({ error: "Interacao invalida." }, { status: 400 });
  }
  if (body.scope !== "ALL" && body.scope !== "FAVORITES" && body.scope !== "SELECTION") {
    return NextResponse.json({ error: "Escopo invalido." }, { status: 400 });
  }
  const mascotIds = body.scope === "SELECTION"
    ? Array.from(new Set(Array.isArray(body.mascotIds) ? body.mascotIds.filter((id): id is string => typeof id === "string") : [])).slice(0, 100)
    : [];
  if (body.scope === "SELECTION" && mascotIds.length === 0) {
    return NextResponse.json({ error: "Nenhum mascote selecionado." }, { status: 400 });
  }
  if (typeof body.idempotencyKey !== "string" || body.idempotencyKey.length < 16 || body.idempotencyKey.length > 100) {
    return NextResponse.json({ error: "Identificador do pedido invalido." }, { status: 400 });
  }

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!player) return NextResponse.json({ error: "Perfil nao encontrado." }, { status: 404 });

  let job: { id: string; status: string };
  try {
    job = await prisma.mascotInteractionJob.create({
      data: {
        playerId: player.id,
        idempotencyKey: body.idempotencyKey,
        interactionType: body.interactionType,
        scope: body.scope,
        targetMascotIds: body.scope === "SELECTION" ? mascotIds : undefined,
      },
      select: { id: true, status: true },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const existing = await prisma.mascotInteractionJob.findUnique({
      where: { idempotencyKey: body.idempotencyKey },
      select: { id: true, status: true, playerId: true },
    });
    if (!existing || existing.playerId !== player.id) {
      return NextResponse.json({ error: "Pedido duplicado invalido." }, { status: 409 });
    }
    job = { id: existing.id, status: existing.status };
  }

  // O pedido ja esta salvo. A resposta pode voltar agora enquanto o trabalho
  // prossegue, inclusive se o usuario navegar ou fechar a aba.
  if (job.status === "PENDING") {
    after(async () => {
      await processMascotInteractionJob(job.id).catch(error => {
        console.error("[bulk-interaction] Falha no disparo imediato", error);
      });
    });
  }

  return NextResponse.json(
    { accepted: true, jobId: job.id, status: job.status },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
