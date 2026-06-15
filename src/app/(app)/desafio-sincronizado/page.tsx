import Image from "next/image";
import { Flame, Send, ShieldBan, Sparkles, Waves } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { SYNC_TICKET_ITEMS, SYNC_TICKET_TYPES, ensureSyncChallengeItems } from "@/lib/sync-challenge";
import {
  combineSyncTicketsAction,
  consumeSyncTicketAction,
  grantDebugSyncTicketAction,
  transferSyncTicketAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function DesafioSincronizadoPage() {
  const session = await getAppSession();
  if (!session?.user) return null;

  const player = await getSessionPlayer(session.user.id);
  if (!player) {
    return <div className="py-20 text-center text-sm text-slate-500">Crie um jogador para acessar o evento.</div>;
  }

  const admin = isAdmin(session.user.role);
  await prisma.$transaction((tx) => ensureSyncChallengeItems(tx));

  const [inventory, players, entries] = await Promise.all([
    prisma.playerInventory.findMany({
      where: {
        playerId: player.id,
        item: { type: { in: Object.values(SYNC_TICKET_TYPES) as never[] } },
      },
      select: {
        quantity: true,
        item: { select: { id: true, type: true, name: true, imageUrl: true, description: true } },
      },
    }),
    prisma.player.findMany({
      where: { id: { not: player.id }, active: true, user: { status: "ACTIVE" } },
      select: { id: true, displayName: true, ptcglNick: true },
      orderBy: { displayName: "asc" },
      take: 80,
    }),
    prisma.syncChallengeEntry.findMany({
      where: { playerId: player.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, status: true, bansJson: true, consumedAt: true },
    }),
  ]);

  const counts = new Map(inventory.map((row) => [row.item.type, row.quantity]));
  const fireCount = counts.get(SYNC_TICKET_TYPES.fireLeft) ?? 0;
  const waterCount = counts.get(SYNC_TICKET_TYPES.waterRight) ?? 0;
  const completeCount = counts.get(SYNC_TICKET_TYPES.complete) ?? 0;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-[#FFCB05]/25 bg-gradient-to-br from-[#170b06] via-[#0b1021] to-[#06131d]">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#FFCB05]">
              <Sparkles size={14} /> Evento de Combate
            </div>
            <div>
              <h1 className="font-pixel text-lg text-[#FFCB05]">Desafio Sincronizado</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Colete a metade esquerda de fogo e a metade direita de agua, envie metades para outros jogadores quando precisar sincronizar,
                junte as duas partes e consuma o ticket completo ao confirmar seus bans.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <TicketCounter label="Fogo esquerda" count={fireCount} tone="fire" />
              <TicketCounter label="Agua direita" count={waterCount} tone="water" />
              <TicketCounter label="Completo" count={completeCount} tone="complete" />
            </div>
          </div>
          <div className="relative min-h-[240px]">
            <Image
              src="/events/desafio-sincronizado/ticket-completo-agua-fogo.png"
              alt="Ticket completo do Desafio Sincronizado"
              fill
              sizes="(max-width: 1024px) 100vw, 420px"
              className="object-contain drop-shadow-[0_0_30px_rgba(255,203,5,0.25)]"
              priority
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {SYNC_TICKET_ITEMS.map((item) => (
          <div key={item.type} className="rounded-2xl border border-border bg-card p-4">
            <div className="relative h-56 rounded-xl bg-slate-950/60">
              <Image src={item.imageUrl} alt={item.name} fill sizes="320px" className="object-contain p-3" />
            </div>
            <div className="mt-4">
              <p className="text-sm font-bold text-slate-100">{item.name}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles size={18} className="text-[#FFCB05]" />
            <h2 className="font-semibold text-slate-100">Juntar ticket completo</h2>
          </div>
          <p className="text-sm text-slate-400">
            Consome 1 metade de fogo e 1 metade de agua para criar 1 ticket completo. O ticket completo e o item consumido para entrar no evento.
          </p>
          <form action={async () => {
            "use server";
            await combineSyncTicketsAction();
          }} className="mt-4">
            <button
              disabled={fireCount < 1 || waterCount < 1}
              className="w-full rounded-xl bg-[#FFCB05] px-4 py-3 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Juntar fogo + agua
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Send size={18} className="text-cyan-300" />
            <h2 className="font-semibold text-slate-100">Enviar para jogador</h2>
          </div>
          <form action={async (formData) => {
            "use server";
            await transferSyncTicketAction(formData);
          }} className="space-y-3">
            <select name="ticketType" className="w-full rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100">
              <option value={SYNC_TICKET_TYPES.fireLeft}>Ticket Esquerda de Fogo</option>
              <option value={SYNC_TICKET_TYPES.waterRight}>Ticket Direita de Agua</option>
              <option value={SYNC_TICKET_TYPES.complete}>Ticket Completo</option>
            </select>
            <select name="targetPlayerId" className="w-full rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100">
              {players.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.displayName}{target.ptcglNick ? ` (${target.ptcglNick})` : ""}
                </option>
              ))}
            </select>
            <input name="quantity" type="number" min={1} max={20} defaultValue={1} className="w-full rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100" />
            <button className="w-full rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-3 text-sm font-bold text-cyan-100">
              Enviar ticket
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldBan size={18} className="text-red-300" />
          <h2 className="font-semibold text-slate-100">Confirmar bans e consumir ticket</h2>
        </div>
        <p className="text-sm text-slate-400">
          Preencha os 3 bans antes de iniciar. Ao confirmar, 1 ticket completo e consumido e a entrada fica registrada no seu historico do evento.
        </p>
        <form action={async (formData) => {
          "use server";
          await consumeSyncTicketAction(formData);
        }} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <input name="ban1" placeholder="Ban 1" className="rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100" />
          <input name="ban2" placeholder="Ban 2" className="rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100" />
          <input name="ban3" placeholder="Ban 3" className="rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100" />
          <button disabled={completeCount < 1} className="rounded-xl bg-red-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
            Consumir
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold text-slate-100">Historico recente</h2>
        <div className="mt-4 space-y-2">
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma entrada consumida ainda.</p>
          ) : entries.map((entry) => {
            const payload = entry.bansJson as { bans?: string[] } | null;
            return (
              <div key={entry.id} className="rounded-xl border border-border bg-slate-950/60 p-3 text-sm">
                <p className="font-semibold text-slate-200">{new Date(entry.consumedAt).toLocaleString("pt-BR")} · {entry.status}</p>
                <p className="mt-1 text-xs text-slate-400">Bans: {(payload?.bans ?? []).join(", ") || "sem registro"}</p>
              </div>
            );
          })}
        </div>
      </section>

      {admin && (
        <section className="rounded-2xl border border-[#FFCB05]/30 bg-[#FFCB05]/5 p-5">
          <h2 className="font-semibold text-[#FFCB05]">Ferramentas admin de teste</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={async () => {
              "use server";
              await grantDebugSyncTicketAction(SYNC_TICKET_TYPES.fireLeft);
            }}>
              <button className="inline-flex items-center gap-2 rounded-lg border border-orange-400/50 px-3 py-2 text-xs font-bold text-orange-200"><Flame size={14} /> Gerar fogo</button>
            </form>
            <form action={async () => {
              "use server";
              await grantDebugSyncTicketAction(SYNC_TICKET_TYPES.waterRight);
            }}>
              <button className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/50 px-3 py-2 text-xs font-bold text-cyan-100"><Waves size={14} /> Gerar agua</button>
            </form>
          </div>
        </section>
      )}
    </div>
  );
}

function TicketCounter({ label, count, tone }: { label: string; count: number; tone: "fire" | "water" | "complete" }) {
  const styles = {
    fire: "border-orange-400/30 bg-orange-500/10 text-orange-100",
    water: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
    complete: "border-[#FFCB05]/30 bg-[#FFCB05]/10 text-[#FFCB05]",
  }[tone];
  return (
    <div className={`rounded-xl border px-4 py-3 ${styles}`}>
      <p className="text-xs uppercase tracking-widest opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-black">{count}</p>
    </div>
  );
}
