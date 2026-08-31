/** LEITURA — inspeciona o(s) emprestimo(s) de negociacao direta recentes entre
 * Drake e Luiz para diagnosticar o fluxo quebrado. Nao altera nada. */
import { existsSync, readFileSync } from "fs"; import { resolve } from "path";
for (const f of [".env",".env.local"]){const p=resolve(process.cwd(),f);if(!existsSync(p))continue;for(const l of readFileSync(p,"utf8").split(/\r?\n/)){const m=l.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);if(!m)continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);process.env[m[1]]??=v;}}
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
(async () => {
  const players = await prisma.player.findMany({
    where: { displayName: { in: ["Drake", "Luiz"], mode: "insensitive" } },
    select: { id: true, displayName: true, wallet: { select: { balance: true, totalEarned: true } } },
  });
  console.log("── Jogadores ─────────────────────────────");
  for (const p of players) console.log(`  ${p.displayName}  id=${p.id}  saldo=${p.wallet?.balance ?? "sem carteira"} (ganho total ${p.wallet?.totalEarned ?? "-"})`);
  const ids = players.map(p => p.id);
  const nameOf = (id: string) => players.find(p => p.id === id)?.displayName ?? id;

  const loans = await prisma.bazarLoan.findMany({
    where: { OR: [{ lenderId: { in: ids } }, { borrowerId: { in: ids } }] },
    orderBy: { createdAt: "desc" }, take: 8,
  });
  console.log("\n── Emprestimos (recentes) ────────────────");
  for (const l of loans) {
    console.log(`  loan=${l.id}  ${l.createdAt.toISOString()}  status=${l.status}`);
    console.log(`     lender(credor)=${nameOf(l.lenderId)}  borrower(devedor)=${nameOf(l.borrowerId)}  principal=${l.principalCoins}  juros=${l.interestPct}%  totalDevido=${l.totalDueCoins}  pago=${l.amountPaidCoins}`);
    console.log(`     listingId=${l.listingId}  proposalId=${l.proposalId}  snapshot=${JSON.stringify(l.itemSnapshot)?.slice(0,160)}`);
  }

  const txs = await prisma.bazarTransaction.findMany({
    where: { OR: [{ sellerId: { in: ids } }, { buyerId: { in: ids } }] },
    orderBy: { createdAt: "desc" }, take: 6,
  });
  console.log("\n── Transacoes recentes ───────────────────");
  for (const t of txs) console.log(`  ${t.createdAt.toISOString()}  ${t.description}  seller=${nameOf(t.sellerId)} buyer=${nameOf(t.buyerId)} coins=${t.coinsAmount}  details=${JSON.stringify(t.detailsJson)?.slice(0,180)}`);

  const props = await prisma.bazarProposal.findMany({
    where: { OR: [{ proposerId: { in: ids } }, { listing: { playerId: { in: ids } } }] },
    orderBy: { updatedAt: "desc" }, take: 6,
    include: { listing: { select: { id: true, playerId: true, status: true, payload: true } } },
  });
  console.log("\n── Propostas/mesas recentes ──────────────");
  for (const p of props) {
    const direct = (p.listing.payload as Record<string, unknown> | null)?.directNegotiation === true;
    console.log(`  prop=${p.id} status=${p.status} direct=${direct} dono=${nameOf(p.listing.playerId)} proposer=${nameOf(p.proposerId)} listing=${p.listing.id}(${p.listing.status}) coinsOffer=${p.coinsOffer} escrow=${p.coinsEscrowed}`);
    if (direct && p.message) console.log(`     state=${p.message.slice(0, 300)}`);
  }
  await prisma.$disconnect();
})().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
