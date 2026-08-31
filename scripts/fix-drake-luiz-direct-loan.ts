/** Correcao pontual da mesa direta Drake→Luiz que quebrou (emprestimo invertido
 * e sem transferencia). Intencao real: Drake emprestou 2.000 ZC a Luiz.
 *
 * Estado atual (bug): loan lender=Luiz, borrower=Drake, 0 ZC movidos.
 * Correto: Drake entrega 2.000 a Luiz agora; Luiz fica devendo 2.000 a Drake.
 *   - Drake: -2000 de saldo
 *   - Luiz : +2000 de saldo (+2000 totalEarned), igual ao fluxo corrigido
 *   - cofre Miauvadao: +200 (faucet de 10%, igual a qualquer entrega de ZC)
 *   - loan: lender=Drake, borrower=Luiz (swap)
 *
 * Simulacao por padrao. Aplique: npx tsx scripts/fix-drake-luiz-direct-loan.ts --apply
 */
import { existsSync, readFileSync } from "fs"; import { resolve } from "path";
for (const f of [".env",".env.local"]){const p=resolve(process.cwd(),f);if(!existsSync(p))continue;for(const l of readFileSync(p,"utf8").split(/\r?\n/)){const m=l.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);if(!m)continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);process.env[m[1]]??=v;}}
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const LOAN_ID = "cmthm5k2w002fjp04vboio7qu";
const AMOUNT = 2000;
const VAULT_CUT = Math.floor(AMOUNT * 0.10);

(async () => {
  const loan = await prisma.bazarLoan.findUnique({ where: { id: LOAN_ID } });
  if (!loan) { console.log("Emprestimo nao encontrado — nada a fazer."); return; }
  if (loan.principalCoins !== AMOUNT) { console.log(`Principal inesperado (${loan.principalCoins}) — abortando por seguranca.`); return; }
  if (loan.amountPaidCoins > 0 || loan.status !== "ACTIVE") { console.log(`Emprestimo ja tem pagamento/estado alterado (pago=${loan.amountPaidCoins}, status=${loan.status}) — abortando.`); return; }

  // No estado bugado: lender=Luiz, borrower=Drake. Drake = quem emprestou de verdade.
  const drakeId = loan.borrowerId; // atualmente devedor (errado) → deveria ser credor
  const luizId  = loan.lenderId;   // atualmente credor (errado)  → deveria ser devedor
  const [drake, luiz] = await Promise.all([
    prisma.player.findUnique({ where: { id: drakeId }, select: { displayName: true, wallet: { select: { balance: true } } } }),
    prisma.player.findUnique({ where: { id: luizId  }, select: { displayName: true, wallet: { select: { balance: true } } } }),
  ]);
  const dBal = drake?.wallet?.balance ?? 0, lBal = luiz?.wallet?.balance ?? 0;
  console.log("── Correcao mesa direta (emprestimo) ──────────────");
  console.log(`  Emprestador (Drake=${drake?.displayName}): ${dBal} → ${dBal - AMOUNT}`);
  console.log(`  Tomador   (Luiz=${luiz?.displayName}):  ${lBal} → ${lBal + AMOUNT}`);
  console.log(`  Loan: lender ${luiz?.displayName} → ${drake?.displayName} ; borrower ${drake?.displayName} → ${luiz?.displayName}`);
  console.log(`  Cofre Miauvadao: +${VAULT_CUT} (faucet 10%)`);
  if (dBal < AMOUNT) { console.log("  ⚠ Drake nao tem saldo suficiente para cobrir os 2000 — abortando."); return; }
  if (!APPLY) { console.log(">>> SIMULACAO. Rode com --apply para aplicar."); return; }

  await prisma.$transaction(async (tx) => {
    await tx.zikaCoinWallet.update({ where: { playerId: drakeId }, data: { balance: { decrement: AMOUNT } } });
    await tx.zikaCoinWallet.upsert({
      where: { playerId: luizId },
      update: { balance: { increment: AMOUNT }, totalEarned: { increment: AMOUNT } },
      create: { playerId: luizId, balance: AMOUNT, totalEarned: AMOUNT },
    });
    await tx.miauvadaoConfig.upsert({ where: { id: "singleton" }, update: { vaultBalance: { increment: VAULT_CUT } }, create: { id: "singleton", vaultBalance: VAULT_CUT } });
    await tx.bazarLoan.update({ where: { id: LOAN_ID }, data: { lenderId: drakeId, borrowerId: luizId } });
    await tx.bazarTransaction.updateMany({
      where: { listingId: loan.listingId, description: "Negociação direta concluída" },
      data: { description: "Negociação direta concluída (empréstimo de Drake a Luiz — corrigido)" },
    });
  });
  console.log(">>> APLICADO: 2000 ZC entregues a Luiz, emprestimo corrigido (credor Drake / devedor Luiz).");
})().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
